@file:OptIn(DelicateCoroutinesApi::class, ExperimentalCoroutinesApi::class)

package content.bot

import com.github.michaelbull.logging.InlineLogger
import content.bot.behaviour.action.BotSwitchLoadout
import content.bot.behaviour.condition.BotEquipmentSetup
import content.bot.behaviour.condition.BotInventorySetup
import content.bot.behaviour.condition.BotSkillLevel
import content.bot.behaviour.activity.IdlePicker
import content.bot.behaviour.skill
import content.bot.combat.ClanWarsBotContext
import content.bot.combat.CombatBotContext
import content.bot.combat.CombatTier
import content.entity.combat.killer
import content.entity.player.combat.special.MAX_SPECIAL_ATTACK
import content.entity.player.combat.special.specialAttack
import content.entity.player.combat.special.specialAttackEnergy
import content.entity.player.dialogue.type.choice
import content.quest.questJournal
import world.gregs.voidps.engine.queue.queue
import content.entity.player.bank.bank
import world.gregs.voidps.engine.inv.transact.operation.RemoveItem.remove
import content.entity.player.bank.ownsItem
import content.entity.player.dialogue.type.statement
import content.bot.behaviour.skill as activitySkill
import content.bot.behaviour.activity.BotActivity
import world.gregs.voidps.engine.inv.transact.operation.MoveItemLimit.moveToLimit
import world.gregs.voidps.engine.inv.transact.TransactionError
import kotlinx.coroutines.*
import world.gregs.voidps.engine.Contexts
import world.gregs.voidps.engine.Script
import world.gregs.voidps.engine.client.PlayerAccountLoader
import world.gregs.voidps.engine.client.command.adminCommand
import world.gregs.voidps.engine.client.command.playerCommand
import world.gregs.voidps.engine.client.command.intArg
import world.gregs.voidps.engine.client.command.stringArg
import world.gregs.voidps.engine.client.message
import world.gregs.voidps.engine.client.variable.start
import world.gregs.voidps.engine.client.variable.stop
import world.gregs.voidps.engine.data.AccountManager
import world.gregs.voidps.engine.data.SaveQueue
import world.gregs.voidps.engine.data.Settings
import world.gregs.voidps.engine.data.definition.AccountDefinitions
import world.gregs.voidps.engine.data.definition.Areas
import world.gregs.voidps.engine.data.definition.EnumDefinitions
import world.gregs.voidps.engine.data.definition.StructDefinitions
import world.gregs.voidps.engine.entity.MAX_PLAYERS
import world.gregs.voidps.engine.entity.World
import world.gregs.voidps.engine.entity.character.move.running
import world.gregs.voidps.engine.entity.character.player.Player
import world.gregs.voidps.engine.entity.character.player.Players
import world.gregs.voidps.engine.entity.character.player.appearance
import world.gregs.voidps.engine.entity.character.player.chat.ChatType
import world.gregs.voidps.engine.entity.character.player.name
import world.gregs.voidps.engine.entity.character.player.sex
import world.gregs.voidps.engine.entity.character.player.skill.Skill
import world.gregs.voidps.engine.entity.character.player.skill.level.Level
import world.gregs.voidps.engine.entity.item.Item
import world.gregs.voidps.engine.inv.add
import world.gregs.voidps.engine.inv.equipment
import world.gregs.voidps.engine.inv.inventory
import world.gregs.voidps.engine.inv.transact.operation.AddItem.add
import world.gregs.voidps.engine.inv.transact.operation.ClearItem.clear
import world.gregs.voidps.engine.timer.*
import world.gregs.voidps.network.client.DummyClient
import world.gregs.voidps.network.login.protocol.visual.update.player.BodyColour
import world.gregs.voidps.network.login.protocol.visual.update.player.BodyPart
import world.gregs.voidps.type.random
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.text.toIntOrNull
import kotlin.time.Duration.Companion.milliseconds

class BotCommands(
    val loader: PlayerAccountLoader,
    val manager: BotManager,
    val accounts: AccountManager,
    private val saveQueue: SaveQueue,
    accountDefinitions: AccountDefinitions,
) : Script {

    private val combatBotsLogger = InlineLogger("CombatBots")
    val bots = mutableListOf<Player>()
    val names = mutableListOf<String>()
    private val allNames = mutableSetOf<String>()
    private val loading = mutableSetOf<String>()
    private val combatBotTiers = mutableMapOf<String, CombatTier>()

    var counter = 0
    val contexts = mutableListOf<CombatBotContext>()

    init {
        // Combat-bot contexts. New minigames register a CombatBotContext here so the generic
        // dispatchers below (playerDeath, entered, maintain timer, ::combatbots) pick them up
        // without touching this file.
        contexts.add(ClanWarsBotContext())

        worldTimerStart("bot_spawn") { TimeUnit.SECONDS.toTicks(Settings["bots.spawnSeconds", 60]) }

        worldTimerTick("bot_spawn") {
            if (counter > Settings["bots.count", 0]) {
                return@worldTimerTick Timer.CANCEL
            }
            spawn()
            return@worldTimerTick Timer.CONTINUE
        }

        // Per-context auto-spawn timers — every arena that any registered context lists in
        // autospawnArenaKeys() gets its own maintain timer. Wired once at script init; the
        // timer body re-resolves the context in case settings reload changes it.
        for (context in contexts) {
            for (arenaKey in context.autospawnArenaKeys()) {
                val timerName = "combat_spawn_$arenaKey"
                worldTimerStart(timerName) { context.autospawnIntervalTicks(arenaKey) }
                worldTimerTick(timerName) {
                    maintainCombatArena(context, arenaKey)
                    Timer.CONTINUE
                }
            }
        }

        playerDespawn {
            if (isBot) {
                manager.remove(bot)
                combatBotTiers.remove(accountName)
            }
        }

        playerDeath {
            val tier = combatBotTiers[accountName] ?: return@playerDeath
            val context = contexts.firstOrNull { it.handles(tier) } ?: return@playerDeath
            if (get("debug", false)) {
                combatBotsLogger.info { "playerDeath fired for '$accountName', tier=${tier.activityId}, context=${context.id}" }
            }
            // Drop policy is the context's call (dangerous-arena bots drop kit; safe-arena
            // bots keep theirs to avoid duplicating the loadout on the floor after applyTier).
            if (!context.shouldDropItems(this, tier)) {
                it.dropItems = false
            }
            // Override default home respawn — drop the bot back inside the arena's spawn area.
            val respawn = context.respawnTile(tier)
            if (respawn != null) {
                it.teleport = respawn
            }
            val capturedAccount = accountName
            World.queue("respawn_tier_$capturedAccount", initialDelay = 10) {
                val target = Players.find(capturedAccount) ?: return@queue
                if (!target.isBot) return@queue
                val freshBot = target.bot
                applyTier(freshBot, tier)
                manager.stop(freshBot)
                freshBot.blocked.remove(tier.activityId)
                freshBot.evaluate.clear()
                freshBot.previous = null
            }
        }

        playerDeath {
            // PvP bots have dropItems=false in the prior handler, so no loot to scan for.
            if (isBot) return@playerDeath
            val slayer = killer as? Player ?: return@playerDeath
            if (!slayer.isBot) return@playerDeath
            slayer.start("loot_pending", LOOT_PENDING_TICKS)
            slayer["loot_drop_tile"] = tile.id
        }

        // Wire one `entered` listener per area any context subscribes to. The handler
        // dispatches by tier → context. Adding a new subscribed area in a new context works
        // automatically as long as that context is registered before this init block runs.
        for (areaId in contexts.flatMapTo(mutableSetOf()) { it.subscribedAreas }) {
            entered(areaId) {
                val tier = combatBotTiers[accountName] ?: return@entered
                val context = contexts.firstOrNull { it.handles(tier) } ?: return@entered
                // Death sequence also fires entered(...) while dead is still true; skip those
                // — playerDeath already schedules a delayed applyTier and we don't want to
                // double up.
                if (dead) return@entered
                context.onAreaEntered(this, tier, areaId)
                if (!context.shouldRefreshOnAreaEntered(this, tier, areaId)) return@entered
                // Restock kit before any portal-entry resolver walks the bot back; without
                // this the bot re-enters the arena with empty inventory and gets stuck/killed.
                val freshBot = bot
                applyTier(freshBot, tier)
                manager.stop(freshBot)
                freshBot.blocked.remove(tier.activityId)
                freshBot.evaluate.clear()
                freshBot.previous = null
            }
        }

        worldSpawn {
            loadSettings()
        }

        settingsReload {
            loadSettings()
        }

        adminCommand("bots", intArg("count", optional = true), desc = "Spawn (count) number of bots", handler = ::spawn)
        adminCommand("clear_bots", intArg("count", optional = true), desc = "Clear all or some amount of bots", handler = ::clear)
        adminCommand("bot", stringArg("task", optional = true, autofill = manager.activityNames), desc = "Toggle yourself on/off as a bot player", handler = ::toggle)
        adminCommand("idle", stringArg("skills", optional = true, autofill = idleOptions), desc = "Idle mode: auto-train skills 1-99, lowest first. Use skill names (comma separated), 'all' or 'off'", handler = ::idle)
        playerSpawn {
            if (!isBot) {
                timers.start("idle_hud")
                // Idle Scape: herblore and runecrafting quests are unlocked, every skill has starting items in the bank
                set("druidic_ritual", "completed")
                set("rune_mysteries", "completed")
                if (!get("idle_bot_funds", false)) {
                    set("idle_bot_funds", true)
                    bank.add("coins", 15000)
                }
                if (!get("idle_kit", false)) {
                    set("idle_kit", true)
                    for ((id, amount) in idleKit) {
                        bank.add(id, amount)
                    }
                }
            }
        }
        timerStart("idle_hud") { 2 }
        timerTick("idle_hud") {
            when {
                dead -> {}
                get("idle_menu_up", false) -> interfaces.sendText("dialogue_multi5", "title", hudText(this))
                else -> {
                    set("idle_menu_up", true)
                    queue("idle_menu", 1) { idleMenu(this) }
                }
            }
            Timer.CONTINUE
        }
        playerCommand("menu", desc = "Bring the Idle Scape menu back") {
            if (!get("idle_menu_up", false)) {
                set("idle_menu_up", true)
                queue("idle_menu", 1) { idleMenu(this) }
            }
            timers.start("idle_hud")
        }
        adminCommand("idle_coverage", desc = "Report which levels 1-99 of each skill have bot activities", handler = ::coverage)
        adminCommand("bot_info", stringArg("name", optional = true, desc = "Filter by bot name", autofill = accountDefinitions.displayNames.keys), desc = "Print bot info", handler = ::info)
        adminCommand("combatbots", stringArg("arena", autofill = { contexts.flatMap { it.arenaKeys() }.toSet() }), intArg("count", optional = true), desc = "Spawn combat bots for a named arena", handler = ::combatBots)
        adminCommand("bot_stress", intArg("ticks", optional = true), intArg("warmup", optional = true), desc = "Measure BotManager perf for N ticks (default 500); optional warmup ticks delay measurement.", handler = ::botStress)
    }

    @Suppress("UNUSED_PARAMETER")
    fun botStress(player: Player, args: List<String>) {
        val ticks = args.getOrNull(0)?.toIntOrNull() ?: 500
        val warmup = args.getOrNull(1)?.toIntOrNull() ?: 0
        if (ticks <= 0) {
            player.message("bot_stress: ticks must be > 0.", ChatType.Console)
            return
        }
        if (BotMetrics.measuring) {
            player.message("bot_stress: a measurement is already running.", ChatType.Console)
            return
        }
        val invokerName = player.accountName
        val onComplete: (List<String>) -> Unit = { lines ->
            val target = Players.find(invokerName)
            if (target != null) {
                for (line in lines) {
                    target.message(line, ChatType.Console)
                }
            }
        }
        if (warmup > 0) {
            player.message("bot_stress: warmup=$warmup ticks, then measure ticks=$ticks.", ChatType.Console)
            World.queue("bot_stress_warmup", initialDelay = warmup) {
                BotMetrics.start(ticks, label = "bots=${manager.bots.size}", onComplete = onComplete)
            }
        } else {
            player.message("bot_stress: measuring ticks=$ticks (bots=${manager.bots.size}).", ChatType.Console)
            BotMetrics.start(ticks, label = "bots=${manager.bots.size}", onComplete = onComplete)
        }
    }

    private fun loadSettings() {
        if (Settings["bots.count", 0] > 0) {
            World.timers.start("bot_spawn")
        }
        if (!Settings["bots.numberedNames", false]) {
            names.clear()
            names.addAll(File(Settings["bots.names"]).readLines())
            allNames.clear()
            allNames.addAll(names.map { it.lowercase() })
        }
        for (context in contexts) {
            context.load()
        }
        for (context in contexts) {
            for (arenaKey in context.autospawnArenaKeys()) {
                if (context.autospawnTarget(arenaKey) > 0) {
                    World.timers.start("combat_spawn_$arenaKey")
                }
            }
        }
    }

    private fun maintainCombatArena(context: CombatBotContext, arenaKey: String) {
        val target = context.autospawnTarget(arenaKey)
        if (target <= 0) return
        val current = combatBotTiers.values.count { context.arenaContains(arenaKey, it) }
        if (current >= target) return
        spawnCombatBot(context, arenaKey)
    }

    @Suppress("UNUSED_PARAMETER")
    fun spawn(player: Player, args: List<String>) {
        val count = args[0].toIntOrNull() ?: 1
        GlobalScope.launch {
            repeat(count) {
                if (it % Settings["network.maxLoginsPerTick", 25] == 0) {
                    suspendCancellableCoroutine { cont ->
                        World.queue("bot_$counter") {
                            cont.resume(Unit)
                        }
                    }
                }
                spawn()
            }
        }
    }

    @Suppress("UNUSED_PARAMETER")
    fun clear(player: Player, args: List<String>) {
        val count = args.getOrNull(0)?.toIntOrNull() ?: MAX_PLAYERS
        World.queue("bot_clear") {
            runBlocking {
                var removed = 0
                for (bot in manager.bots.toList()) {
                    if (bot.player.client != null && bot.player.client !is DummyClient) {
                        continue
                    }
                    manager.remove(bot)
                    Script.launch {
                        accounts.logout(bot.player, true)
                    }
                    if (++removed >= count) {
                        break
                    }
                }
            }
        }
    }

    fun info(player: Player, args: List<String>) {
        if (player.isBot) {
            player.message("Available activities:", ChatType.Console)
            for (activity in player.bot.available) {
                player.message("  $activity", ChatType.Console)
            }
        }
        val filter = args.getOrNull(0)
        val info = mutableListOf<String>()
        for (bot in manager.bots) {
            if (filter != null && !filter.equals(bot.player.name, ignoreCase = true)) {
                continue
            }
            info.add(bot.player.name)
            for (frame in bot.frames) {
                info.add("<blue>${frame.behaviour.id} - ${frame.state}")
            }
        }
        player.questJournal("Bots List", info.take(300))
    }

    fun toggle(player: Player, args: List<String>) {
        if (player.isBot) {
            manager.remove(player.bot)
            player.clear("bot")
            player.message("Bot disabled.")
        } else {
            val bot = player.initBot()
            manager.add(bot)
            if (args.getOrNull(0)?.isNotBlank() == true) {
                bot.available.clear()
                val name = args[0]
                bot.blocked.remove(name)
                bot.available.add(name)
                manager.assign(bot, name)
            }
            player.message("Bot enabled.")
        }
    }

    private val idleOptions: Set<String>
        get() = Skill.entries.map { it.name.lowercase() }.toSet() + setOf("all", "off")

    /**
     * Idle mode, the player trains skills automatically walking between locations; always the lowest level skill first.
     * `::idle` or `::idle all` trains everything, `::idle mining,fishing` a selection, `::idle off` stops.
     */
    fun idle(player: Player, args: List<String>) {
        val arg = args.getOrNull(0)?.lowercase()?.trim().orEmpty()
        if (arg == "off" || (arg.isEmpty() && player.isBot && player.bot.idleSkills.isNotEmpty())) {
            if (player.isBot) {
                manager.remove(player.bot)
                player.clear("bot")
            }
            player.message("Idle mode disabled.")
            return
        }
        val skills = if (arg.isEmpty() || arg == "all") {
            Skill.entries.map { it.name.lowercase() }.toSet()
        } else {
            val names = arg.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            val unknown = names.filter { it !in idleOptions }
            if (unknown.isNotEmpty()) {
                player.message("Unknown skills: ${unknown.joinToString()}. Options: ${idleOptions.joinToString()}.", ChatType.Console)
                return
            }
            names.toSet()
        }
        val bot = if (player.isBot) player.bot else player.initBot().also { manager.add(it) }
        bot.idleSkills = skills
        bot.pinned = null
        bot.stop()
        player.message("Idle mode enabled for ${if (skills.size == Skill.entries.size) "all skills" else skills.joinToString()}.")
    }

    /**
     * Static check of [content.bot.behaviour.condition.BotSkillLevel] ranges of every activity grouped by trained skill,
     * lists the level ranges with no activity.
     */
    fun coverage(player: Player, args: List<String>) {
        val covered = Skill.entries.associateWith { BooleanArray(100) }
        for (id in manager.activityNames) {
            val activity = manager.activity(id) ?: continue
            val trained = activity.skill?.let { IdlePicker.skill(it) } ?: continue
            val range = activity.requires.filterIsInstance<BotSkillLevel>().filter { it.skill == trained }
            val min = range.maxOfOrNull { it.min ?: 1 } ?: 1
            val max = range.minOfOrNull { it.max ?: 99 } ?: 99
            for (level in min.coerceAtLeast(1)..max.coerceAtMost(99)) {
                covered.getValue(trained)[level] = true
            }
        }
        for ((skill, levels) in covered) {
            val gaps = mutableListOf<String>()
            var start = -1
            for (level in 1..100) {
                val missing = level < 100 && !levels[level]
                if (missing && start == -1) start = level
                if (!missing && start != -1) {
                    gaps.add(if (start == level - 1) "$start" else "$start-${level - 1}")
                    start = -1
                }
            }
            val text = "${skill.name}: ${if (gaps.isEmpty()) "full 1-99" else "gaps " + gaps.joinToString()}"
            player.message(text, ChatType.Console)
        }
    }

    fun spawn() {
        GlobalScope.launch(Contexts.Game) {
            counter++
            val index = counter
            val name = pickSavedBot() ?: if (Settings["bots.numberedNames", false]) {
                "Bot $counter"
            } else {
                val prefix = Settings["bots.namePrefix", ""].trim('"')
                val length = 12 - prefix.length
                val short = names.filter { it.length < length }
                var selected = short.randomOrNull(random)
                if (selected == null) {
                    selected = names.removeAt(random.nextInt(names.size))
                } else {
                    names.remove(selected)
                }
                "${prefix}$selected"
            }
            val areas = setOf("lumbridge_teleport", "varrock_teleport", "draynor_bank", "camelot_teleport")
            val saved = saveQueue.loadBot(name)?.toPlayer()
            val player = saved ?: Player(tile = Areas[areas.random()].random(), accountName = name)
            val bot = player.initBot()
            loader.connect(player, DummyClient(), viewport = Settings["development.bots.live", false])
            if (saved == null) {
                setAppearance(player)
                player.inventory.add("coins", 10000)
            }
            player.viewport?.loaded = true
            delay(3.milliseconds)
            manager.add(bot)
            player.running = true
            loading.remove(name)
            if (Settings["development.idle.test", false]) {
                val testSkill = Skill.entries[(index - 1) % Skill.entries.size]
                bot.idleSkills = setOf(testSkill.name.lowercase())
                bot.pinned = null
                bot.stop()
                while (true) {
                    delay(30_000)
                    println("IDLETEST ${testSkill.name} lvl=${player.levels.getMax(testSkill)} xp=${player.experience.get(testSkill).toInt()} activity=${bot.activity?.id} tile=${player.tile}")
                }
            }
        }
    }

    /**
     * Has a `bots.spawnSavedChance` of returning username of a saved bots which isn't already online.
     */
    private fun pickSavedBot(): String? {
        val chance = Settings["bots.spawnSavedChance", 0]
        if (chance <= 0 || random.nextInt(100) >= chance) {
            return null
        }
        val name = saveQueue.savedBotNames()
            .filter { isBotName(it) && Players.findByAccount(it) == null && it !in loading }
            .randomOrNull(random) ?: return null
        loading.add(name)
        // Stop the same name being picked randomly
        val prefix = Settings["bots.namePrefix", ""].trim('"')
        names.removeIf { "$prefix$it".equals(name, ignoreCase = true) }
        return name
    }

    /**
     * Checks if a saved account is a bot account or not.
     */
    private fun isBotName(name: String): Boolean {
        if (Settings["storage.bots.save", false] && Settings["storage.bots.separate", false] && Settings["storage.type", "files"] == "files") {
            return true
        }
        if (Settings["bots.numberedNames", false]) {
            return name.matches(NUMBERED_NAME)
        }
        val prefix = Settings["bots.namePrefix", ""].trim('"')
        return name.startsWith(prefix, ignoreCase = true) && allNames.contains(name.substring(prefix.length).lowercase())
    }


    /** Idle Scape panel: lives in the chat box, always reopens (login, death, respawn); the title line is a live status. */
    private suspend fun idleMenu(player: Player) {
        val lines = listOf("Skilling spots (areas + levels)", "Combat spots (areas + levels)", "My bank + quick actions", "Manage bots (idle heroes)", "Cancel current task")
        try {
            while (true) {
                when (player.choice(lines, hudText(player))) {
                    1 -> skillList(player, 0)
                    2 -> spotList(player, "Combat", combatSkills, 0)
                    3 -> bankView(player)
                    4 -> manageBots(player)
                    5 -> { cancelFocus(player); idle(player, listOf("off")) }
                    // The game closes dialogues when the player walks: reopen straight away so the chat box never comes back
                    else -> player.delay(1)
                }
            }
        } finally {
            player["idle_menu_up"] = false
        }
    }

    private val idleKit = listOf(
        "coins" to 5000, "bronze_pickaxe" to 1, "bronze_hatchet" to 1, "tinderbox" to 1, "small_fishing_net" to 1,
        "fishing_rod" to 1, "fly_fishing_rod" to 1, "feather" to 500, "knife" to 1, "hammer" to 1, "chisel" to 1,
        "needle" to 1, "thread" to 200, "leather" to 40, "bronze_bar" to 40, "copper_ore" to 40, "tin_ore" to 40,
        "ring_mould" to 1, "necklace_mould" to 1, "bracelet_mould" to 1, "gold_bar" to 10, "silver_bar" to 10,
        "uncut_sapphire" to 10, "uncut_emerald" to 10, "soft_clay" to 20, "glassblowing_pipe" to 1,
        "molten_glass" to 20, "bucket_of_sand" to 20, "soda_ash" to 20, "shortbow" to 1, "bronze_arrow" to 300,
        "logs" to 100, "air_rune" to 1000, "mind_rune" to 1000, "fire_rune" to 500, "pestle_and_mortar" to 1,
        "vial_of_water" to 30, "spade" to 1, "rake" to 1, "bronze_sword" to 1, "bronze_scimitar" to 1,
        "bread" to 60, "cooked_meat" to 40, "tuna" to 30, "bones" to 0,
    ).filter { it.second > 0 }

    /** Bots hired by each controlling player (account name -> bots). All of them share the controller's bank. */
    private val hired = mutableMapOf<String, MutableList<Player>>()
    private var hiredCounter = 0

    private fun botCost(player: Player) = 10_000 * ((hired[player.accountName]?.size ?: 0) + 1)

    private fun liveBots(player: Player) = hired[player.accountName].orEmpty().filter { Players.findByAccount(it.accountName) != null }

    private suspend fun manageBots(player: Player) {
        val lines = listOf("Hire a bot (next costs ${"%,d".format(botCost(player))} coins)", "All bots copy my current task", "All bots train ALL skills", "Stop all bots", "Back")
        while (true) {
            val bots = liveBots(player)
            hired[player.accountName] = bots.toMutableList()
            val title = "Bots: ${bots.size} working - all share your bank - coins: ${"%,d".format(player.bank.count("coins"))}"
            when (player.choice(lines, title)) {
                1 -> hireBot(player)
                2 -> {
                    val me = if (player.isBot) player.bot else null
                    for (bot in bots) {
                        val b = bot.bot
                        b.idleSkills = me?.idleSkills?.ifEmpty { null } ?: Skill.entries.map { it.name.lowercase() }.toSet()
                        b.focus = me?.focus
                        b.pinned = null
                        b.stop()
                    }
                    player.message("${bots.size} bots now copy your task.")
                }
                3 -> {
                    for (bot in bots) {
                        val b = bot.bot
                        b.idleSkills = Skill.entries.map { it.name.lowercase() }.toSet()
                        b.focus = null
                        b.stop()
                    }
                    player.message("${bots.size} bots train all skills.")
                }
                4 -> {
                    for (bot in bots) {
                        val b = bot.bot
                        b.idleSkills = emptySet()
                        b.focus = null
                        b.stop()
                    }
                    player.message("All bots stopped.")
                }
                else -> return
            }
            if (player.choice(listOf("Manage bots", "Back to main menu"), "Bots updated") != 1) return
        }
    }

    private fun hireBot(controller: Player) {
        val cost = botCost(controller)
        if (controller.bank.count("coins") < cost) {
            controller.message("A bot costs ${"%,d".format(cost)} coins in your bank - you have ${"%,d".format(controller.bank.count("coins"))}.")
            return
        }
        controller.bank.transaction { remove("coins", cost) }
        if (controller.bank.transaction.error != TransactionError.None) {
            controller.message("Could not take payment from your bank.")
            return
        }
        val index = ++hiredCounter
        val name = "IdleBot$index"
        GlobalScope.launch(Contexts.Game) {
            val player = Player(tile = controller.tile, accountName = name)
            player["bank_owner"] = controller.accountName
            val bot = player.initBot()
            loader.connect(player, DummyClient(), viewport = Settings["development.bots.live", false])
            setAppearance(player)
            player.viewport?.loaded = true
            delay(3.milliseconds)
            manager.add(bot)
            player.running = true
            bot.idleSkills = Skill.entries.map { it.name.lowercase() }.toSet()
            bot.stop()
            hired.getOrPut(controller.accountName) { mutableListOf() }.add(player)
            controller.message("You hired $name for ${"%,d".format(cost)} coins. It works from your bank.")
        }
    }

    private val combatSkills = setOf("attack", "strength", "defence", "ranged", "magic", "prayer")

    private fun cancelFocus(player: Player) {
        if (player.isBot) player.bot.focus = null
    }

    private fun clip(text: String, max: Int = 48) = if (text.length <= max) text else text.take(max - 1) + "~"

    private suspend fun skillList(player: Player, page: Int) {
        val skills = Skill.entries.filter { it != Skill.Constitution && it.name.lowercase() !in combatSkills }
        val perPage = 4
        val slice = skills.drop(page * perPage).take(perPage)
        val hasMore = (page + 1) * perPage < skills.size
        val lines = slice.map { "${it.name} (your level ${player.levels.getMax(it)})" } + if (hasMore) "More skills..." else "Back"
        val choice = player.choice(lines, hudText(player))
        when {
            choice == -1 -> return
            choice <= slice.size -> spotList(player, slice[choice - 1].name, setOf(slice[choice - 1].name.lowercase()), 0)
            hasMore -> skillList(player, page + 1)
        }
    }

    private fun minLevel(activity: BotActivity, skill: Skill?): Int =
        activity.requires.filterIsInstance<BotSkillLevel>().firstOrNull { skill == null || it.skill == skill }?.min ?: 1

    private fun maxLevel(activity: BotActivity, skill: Skill?): Int? =
        activity.requires.filterIsInstance<BotSkillLevel>().firstOrNull { skill == null || it.skill == skill }?.max

    /** What a spot needs: (readable item, owned) pairs, owned means carried, equipped or in the bank - read live every time. */
    private fun itemNeeds(player: Player, spot: BotActivity): List<Pair<String, Boolean>> {
        val needs = mutableListOf<Pair<String, Boolean>>()
        for (condition in spot.setup) {
            val items = when (condition) {
                is BotEquipmentSetup -> condition.items.values.toList()
                is BotInventorySetup -> condition.items.filter { it.ids.none { id -> id == "empty" } }
                else -> emptyList()
            }
            for (item in items) {
                needs += readable(item.ids.first()) to item.ids.any { player.ownsItem(it) }
            }
        }
        return needs
    }

    private fun canDo(player: Player, spot: BotActivity): Boolean {
        val skill = IdlePicker.skill(spot.activitySkill ?: "")
        if (skill != null && player.levels.getMax(skill) < minLevel(spot, skill)) return false
        return itemNeeds(player, spot).all { it.second }
    }

    private fun blue(text: String) = "<col=0000ff>$text</col>"
    private fun black(text: String) = "<col=000000>$text</col>"

    /** Training spots for [skills]: doable ones (level + items in bank) in blue first, the rest in black. */
    private suspend fun spotList(player: Player, title: String, skills: Set<String>, page: Int) {
        val spots = manager.activityNames.mapNotNull { manager.activity(it) }
            .filter { it.activitySkill in skills }
            .distinctBy { readable(it.id) }
            .sortedWith(compareBy({ !canDo(player, it) }, { minLevel(it, IdlePicker.skill(it.activitySkill ?: "")) }))
        if (spots.isEmpty()) {
            player.message("No $title spots are available.")
            return
        }
        val perPage = 4
        val slice = spots.drop(page * perPage).take(perPage)
        val hasMore = (page + 1) * perPage < spots.size
        val lines = slice.map { spot ->
            val skill = IdlePicker.skill(spot.activitySkill ?: "")
            val text = clip("Lv${minLevel(spot, skill)}+ ${readable(spot.id)}")
            if (canDo(player, spot)) blue(text) else black(text)
        } + if (hasMore) "More spots..." else "Back"
        val choice = player.choice(lines, "$title - blue = you can do it now (page ${page + 1} of ${(spots.size + perPage - 1) / perPage})")
        when {
            choice == -1 -> return
            choice <= slice.size -> spotDetails(player, slice[choice - 1])
            hasMore -> spotList(player, title, skills, page + 1)
        }
    }

    private suspend fun spotDetails(player: Player, spot: BotActivity) {
        val skill = IdlePicker.skill(spot.activitySkill ?: "")
        val min = minLevel(spot, skill)
        val max = maxLevel(spot, skill)
        val have = skill?.let { player.levels.getMax(it) } ?: 1
        val needs = itemNeeds(player, spot)
        val where = spot.area?.let { readable(it.id) } ?: "anywhere"
        val itemText = if (needs.isEmpty()) "none" else needs.take(5).joinToString(", ") { (name, owned) -> if (owned) blue(name) else black("$name (missing)") }
        val text = buildString {
            appendLine("${readable(spot.id)}  -  $where")
            appendLine("Level needed: $min${if (max != null) " (best until $max)" else ""}  -  you: $have")
            appendLine("Items: $itemText")
            append("Items are checked in your inventory, equipment and bank.")
        }
        player.statement(text)
        if (skill != null && have < min) {
            player.message("You need level $min ${skill.name} for this spot (you have $have).")
            return
        }
        if (needs.any { !it.second }) {
            player.message("You are missing items for this spot - get them from a shop or the Lumbridge General Store.")
            return
        }
        when (player.choice(listOf("Start training here", "Back"), "Start ${readable(spot.id)}?")) {
            1 -> startSpot(player, spot)
        }
    }

    /** Lists what is in the bank right now. */
    private suspend fun bankView(player: Player) {
        val items = player.bank.items.filter { !it.isEmpty() }
        val names = items.take(24).map { "${it.def.name} x${it.amount}" }
        val text = if (names.isEmpty()) "Your bank is empty." else "Bank (${items.size} items): " + names.chunked(4).take(4).joinToString("\n") { it.joinToString(", ") }
        player.statement(text)
        when (player.choice(listOf("Grab best food from bank", "Train ALL skills (lowest first)", "Back"), "Your bank")) {
            1 -> grabFood(player)
            2 -> { cancelFocus(player); idle(player, listOf("all")) }
        }
    }

    private fun startSpot(player: Player, spot: BotActivity) {
        val skill = spot.activitySkill ?: return
        val bot = if (player.isBot) player.bot else player.initBot().also { manager.add(it) }
        bot.idleSkills = setOf(skill)
        bot.focus = spot.id
        bot.pinned = null
        bot.stop()
        player.message("Training ${readable(spot.id)}.")
    }

    /** Moves the best food from the bank into the inventory before starting. */
    private fun grabFood(player: Player) {
        val food = player.bank.items.filter { !it.isEmpty() && it.def.options.contains("Eat") && it.def.contains("heals") }
            .sortedByDescending { (it.def.getOrNull<IntRange>("heals")?.last ?: 0) }
        if (food.isEmpty()) {
            player.message("You have no food in your bank.")
            return
        }
        var total = 0
        for (item in food) {
            val inv = player.inventory
            if (inv.spaces <= 0) break
            var moved = 0
            player.bank.transaction { moved = moveToLimit(item.id, minOf(item.amount, inv.spaces), inv) }
            if (player.bank.transaction.error == TransactionError.None) total += moved
        }
        player.message(if (total > 0) "You grab $total food from your bank." else "No room in your inventory for food.")
    }

    private fun readable(id: String): String = id.replace('_', ' ').split(' ').joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }

    /** One line, human readable: what the idle player is doing and where. */
    private fun hudText(player: Player): String {
        if (!player.isBot || player.bot.idleSkills.isEmpty()) return "Idle Scape: idle mode is OFF - choose what to train"
        val bot = player.bot
        val hp = "HP ${player.levels.get(Skill.Constitution) / 10}/${player.levels.getMax(Skill.Constitution) / 10}"
        val activity = bot.activity as? BotActivity
        val task = activity?.let { readable(it.id) } ?: "Choosing next task"
        val dest = bot.destination()
        val where = when {
            dest != null -> "walking to ${readable(dest.name)}"
            activity?.area != null -> "at ${readable(activity.area!!.id)}"
            else -> "looking around"
        }
        return "$task - $where - $hp"
    }

    fun Player.initBot(): Bot {
        val bot = Bot(this)
        this["bot"] = bot
        return bot
    }

    fun combatBots(player: Player, args: List<String>) {
        val arenaKey = args[0]
        val context = contexts.firstOrNull { arenaKey in it.arenaKeys() }
        if (context == null) {
            val keys = contexts.flatMap { it.arenaKeys() }.joinToString()
            player.message("Unknown arena '$arenaKey'. Options: $keys.", ChatType.Console)
            return
        }
        val count = args.getOrNull(1)?.toIntOrNull() ?: 14
        GlobalScope.launch {
            repeat(count) { index ->
                if (index % Settings["network.maxLoginsPerTick", 25] == 0) {
                    suspendCancellableCoroutine { cont ->
                        World.queue("combatbot_$counter") { cont.resume(Unit) }
                    }
                }
                spawnCombatBot(context, arenaKey)
            }
        }
    }

    private fun spawnCombatBot(context: CombatBotContext, arenaKey: String) {
        GlobalScope.launch(Contexts.Game) {
            counter++
            val name = pickBotName()
            val spawn = context.arenaSpawn(arenaKey) ?: return@launch
            val saved = saveQueue.loadBot(name)?.toPlayer()
            val bot = (saved?.apply { tile = spawn } ?: Player(tile = spawn, accountName = name)).initBot()
            loader.connect(bot.player, DummyClient(), viewport = Settings["development.bots.live", false])
            if (saved == null) {
                setAppearance(bot.player)
            }
            delay(3.milliseconds)
            val tiers = context.arenaTiers(arenaKey)
            if (tiers.isEmpty()) return@launch
            val tier = tiers.random(random)
            combatBotTiers[bot.player.accountName] = tier
            applyTier(bot, tier)
            manager.add(bot)
            bot.pinned = tier.activityId
            // Intentionally leave bot.refresh = null. BotManager.start's refresh path was
            // re-running applyTier every Pending tick whenever a setup item differed from
            // the template (e.g. dose-decremented potions, mid-fight spec weapon swaps),
            // which spun bots into a drink/eat/refresh loop. The surrounding `continue`
            // in start() still keeps pinned PvP bots out of bank-chest resolvers without
            // needing refresh; legitimate tier resets happen in the `playerDeath` handler.
            bot.available.clear()
            bot.available.add(tier.activityId)
            bot.blocked.remove(tier.activityId)
            manager.assign(bot, tier.activityId)
            bot.player.running = true
        }
    }

    private fun applyTier(bot: Bot, tier: CombatTier) {
        val target = bot.player
        for ((skill, level) in tier.levels) {
            val stored = if (skill == Skill.Constitution) level * 10 else level
            target.experience.set(skill, Level.experience(skill, stored))
            target.levels.set(skill, stored)
        }
        // Belt-and-braces full restore: HP + prayer to max (in case the tier omits one), special
        // attack energy to 100%, and clear any half-pressed spec toggle from the previous round.
        target.levels.clear(Skill.Constitution)
        target.levels.clear(Skill.Prayer)
        target.specialAttackEnergy = MAX_SPECIAL_ATTACK
        target.specialAttack = false
        target["combat_style"] = tier.style
        target["brew_doses_since_restore"] = 0
        target.stop("just_ate_food")
        val activity = manager.activity(tier.activityId) ?: return
        target.inventory.transaction { clear() }
        target.equipment.transaction { clear() }
        target.inventory.add("coins", 10000)
        for (condition in activity.setup) {
            when (condition) {
                is BotEquipmentSetup -> target.equipment.transaction {
                    for ((slot, item) in condition.items) {
                        val usable = item.ids.filter { it != "empty" && !it.endsWith("_noted") && !it.endsWith("_broken") }
                        val id = usable.randomOrNull() ?: item.ids.filter { it != "empty" }.randomOrNull() ?: continue
                        set(slot.index, Item(id, item.min ?: 1))
                    }
                }.also { ok -> if (!ok) combatBotsLogger.warn { "equipment transaction failed for ${target.accountName}: ${target.equipment.transaction.error}" } }
                is BotInventorySetup -> target.inventory.transaction {
                    for (item in condition.items) {
                        val id = item.ids.filter { it != "empty" }.randomOrNull() ?: continue
                        add(id, item.min ?: 1)
                    }
                }.also { ok -> if (!ok) combatBotsLogger.warn { "inventory transaction failed for ${target.accountName}: ${target.inventory.transaction.error}" } }
                else -> Unit
            }
        }
        val starting = activity.reactive.firstOrNull { it is BotSwitchLoadout }?.let { (it as BotSwitchLoadout).startingLoadout }
        if (starting != null) {
            target["current_loadout"] = starting
            target["last_loadout_swap_tick"] = -10_000
        }
        for ((name, loadout) in activity.loadouts) {
            if (name == starting) continue
            target.inventory.transaction {
                for ((_, item) in loadout.equipment.items) {
                    val usable = item.ids.filter { it != "empty" && !it.endsWith("_noted") && !it.endsWith("_broken") }
                    val id = usable.randomOrNull() ?: item.ids.filter { it != "empty" }.randomOrNull() ?: continue
                    if (target.equipment.contains(id)) continue
                    if (target.inventory.contains(id)) continue
                    add(id, item.min ?: 1)
                }
                loadout.extraInventory?.items?.forEach { item ->
                    val id = item.ids.filter { it != "empty" }.randomOrNull() ?: return@forEach
                    add(id, item.min ?: 1)
                }
            }.also { ok -> if (!ok) combatBotsLogger.warn { "loadout '$name' didn't fit for ${target.accountName}: ${target.inventory.transaction.error}" } }
        }
        if (bot["debug", false]) {
            combatBotsLogger.info { "applyTier ${tier.activityId} for ${target.accountName}: levels=${tier.levels.map { "${it.key}=cur${target.levels.get(it.key)}/max${target.levels.getMax(it.key)}" }}" }
            combatBotsLogger.info { "  inventory=${(0 until target.inventory.size).mapNotNull { target.inventory.getOrNull(it) }.filter { it.id.isNotEmpty() }.map { "${it.id}x${it.amount}" }}" }
            combatBotsLogger.info { "  equipment=${(0 until target.equipment.size).mapNotNull { target.equipment.getOrNull(it) }.filter { it.id.isNotEmpty() }.map { "${it.id}x${it.amount}" }}" }
            for (condition in activity.setup) {
                combatBotsLogger.info { "  setup.check ${condition::class.simpleName} = ${condition.check(target)}" }
            }
        }
    }

    private fun pickBotName(): String {
        if (Settings["bots.numberedNames", false]) return "Bot $counter"
        val prefix = Settings["bots.namePrefix", ""].trim('"')
        val length = 12 - prefix.length
        val short = names.filter { it.length < length }
        val selected = short.randomOrNull(random) ?: names.removeAt(random.nextInt(names.size))
        names.remove(selected)
        return "$prefix$selected"
    }

    fun setAppearance(player: Player): Player {
        val male = random.nextBoolean()
        player.body.male = male
        val key = "look_hair_${if (male) "male" else "female"}"
        player.body.setLook(BodyPart.Hair, EnumDefinitions.getStruct(key, random.nextInt(0, EnumDefinitions.get(key).length), "body_look_id"))
        player.body.setLook(BodyPart.Beard, if (male) EnumDefinitions.get("look_beard_male").randomInt() else -1)
        val size = EnumDefinitions.get("character_styles").length
        val style = EnumDefinitions.getStruct("character_styles", (0 until size).random(), "character_creation_sub_style_${player.sex}_0", -1)
        val struct = StructDefinitions.get(style)
        player.body.setLook(BodyPart.Chest, struct["character_style_top"])
        player.body.setLook(BodyPart.Arms, struct["character_style_arms"])
        player.body.setLook(BodyPart.Hands, struct["character_style_wrists"])
        player.body.setLook(BodyPart.Legs, struct["character_style_legs"])
        player.body.setLook(BodyPart.Feet, struct["character_style_shoes"])
        val offset = random.nextInt(0, 8)
        player.body.setColour(BodyColour.Hair, EnumDefinitions.get("colour_hair").randomInt())
        player.body.setColour(BodyColour.Top, struct["character_style_colour_top_$offset"])
        player.body.setColour(BodyColour.Legs, struct["character_style_colour_legs_$offset"])
        player.body.setColour(BodyColour.Feet, struct["character_style_colour_shoes_$offset"])
        player.body.setColour(BodyColour.Skin, EnumDefinitions.get("character_skin").randomInt())
        player.appearance.emote = 1426
        return player
    }

    companion object {
        private const val LOOT_PENDING_TICKS = 60

        private val NUMBERED_NAME = Regex("Bot \\d+")
    }
}
