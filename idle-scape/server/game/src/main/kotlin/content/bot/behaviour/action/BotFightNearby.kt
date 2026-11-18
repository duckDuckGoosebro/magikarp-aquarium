package content.bot.behaviour.action

import content.bot.Bot
import content.bot.behaviour.BehaviourFrame
import content.bot.behaviour.BehaviourState
import content.bot.behaviour.BotWorld
import content.bot.behaviour.Reason
import content.entity.combat.attacker
import content.entity.combat.underAttack
import content.skill.melee.weapon.fightStyle
import world.gregs.voidps.engine.client.variable.start
import world.gregs.voidps.engine.entity.character.mode.EmptyMode
import world.gregs.voidps.engine.entity.character.mode.interact.PlayerOnFloorItemInteract
import world.gregs.voidps.engine.entity.character.mode.interact.PlayerOnNPCInteract
import world.gregs.voidps.engine.entity.character.npc.NPCs
import world.gregs.voidps.engine.entity.item.floor.FloorItems
import world.gregs.voidps.engine.inv.inventory
import world.gregs.voidps.engine.map.Spiral
import world.gregs.voidps.network.client.instruction.InteractFloorItem
import world.gregs.voidps.network.client.instruction.InteractInterface
import world.gregs.voidps.network.client.instruction.InteractNPC

/**
 * Acts like a real player roaming a spot: buries bones, picks up its own drops, then attacks whichever
 * creature nearby has a combat level of at most [maxLevel].
 */
data class BotFightNearby(
    val maxLevel: Int = 10,
    val radius: Int = 12,
    val bury: Boolean = true,
    val loot: Boolean = true,
) : BotAction {

    override fun update(bot: Bot, world: BotWorld, frame: BehaviourFrame): BehaviourState? = when {
        bot.mode is PlayerOnNPCInteract -> BehaviourState.Running
        bot.mode is PlayerOnFloorItemInteract -> BehaviourState.Running
        bot.mode is EmptyMode -> act(bot, world)
        else -> null
    }

    private fun act(bot: Bot, world: BotWorld): BehaviourState {
        val player = bot.player
        if (bury) {
            val inventory = player.inventory
            for (index in inventory.indices) {
                val item = inventory[index]
                if (item.isEmpty()) {
                    continue
                }
                val option = item.def.options.indexOf("Bury")
                if (option == -1) {
                    continue
                }
                val valid = world.execute(player, InteractInterface(149, 0, item.def.id, index, option))
                if (!valid) {
                    return BehaviourState.Failed(Reason.Invalid("Invalid bury interaction: ${item.def.id} $index $option"))
                }
                return BehaviourState.Wait(2, BehaviourState.Running)
            }
        }
        val hasSpace = player.inventory.spaces > 0
        for (tile in Spiral.spiral(player.tile, radius)) {
            if (loot && hasSpace) {
                for (item in FloorItems.at(tile)) {
                    if (item.owner != player.accountName) {
                        continue
                    }
                    val index = item.def.floorOptions.indexOf("Take")
                    if (index == -1) {
                        continue
                    }
                    val valid = world.execute(player, InteractFloorItem(item.def.id, item.tile.x, item.tile.y, index))
                    if (!valid) {
                        return BehaviourState.Failed(Reason.Invalid("Invalid floor item interaction: $item $index"))
                    }
                    return BehaviourState.Running
                }
            }
            for (npc in NPCs.at(tile)) {
                val def = npc.def(player)
                val index = def.options.indexOf("Attack")
                if (index == -1 || def.combat < 1 || def.combat > maxLevel) {
                    continue
                }
                if (npc.dead || (npc.underAttack && npc.attacker != player)) {
                    continue
                }
                if (!world.canReach(player, npc) && (player.fightStyle == "melee" || !world.canSee(player, npc))) {
                    continue
                }
                val valid = world.execute(player, InteractNPC(npc.index, index + 1))
                if (!valid) {
                    return BehaviourState.Failed(Reason.Invalid("Invalid npc interaction: ${npc.index} ${index + 1}"))
                }
                player.start("fight_starting", 5)
                return BehaviourState.Running
            }
        }
        // Nothing nearby right now, wait for creatures to respawn like a player would
        return BehaviourState.Wait(3, BehaviourState.Running)
    }
}
