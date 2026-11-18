package content.bot.behaviour.activity

import content.bot.Bot
import content.bot.behaviour.skill
import world.gregs.voidps.engine.entity.character.player.skill.Skill
import world.gregs.voidps.type.random

/**
 * Idle mode: bots with [Bot.idleSkills] only train those skills, always the lowest level one that has an eligible activity.
 * Skills at 99 are finished and skipped. When nothing can be done the bot waits and tries again.
 */
object IdlePicker : ActivityPicker {
    const val MAX_LEVEL = 99

    fun skill(name: String): Skill? = Skill.entries.firstOrNull { it.name.equals(name, ignoreCase = true) }

    override fun pick(bot: Bot, activities: Map<String, BotActivity>, idle: BotActivity, eligible: (BotActivity?) -> Boolean): BotActivity? {
        if (bot.idleSkills.isEmpty()) {
            return null
        }
        val focused = bot.focus?.let { id -> activities[id]?.takeIf { id in bot.available && eligible(it) } }
        if (focused != null) {
            return focused
        }
        val candidates = bot.available
            .mapNotNull { activities[it] }
            .filter { activity -> activity.skill in bot.idleSkills && eligible(activity) }
            .filter { activity -> level(bot, activity.skill) < MAX_LEVEL }
        if (candidates.isEmpty()) {
            return idle
        }
        return candidates
            .groupBy { it.skill }
            .minBy { (skill, _) -> level(bot, skill) }
            .value
            .random(random)
    }

    private fun level(bot: Bot, name: String?): Int {
        val skill = name?.let { skill(it) } ?: return MAX_LEVEL
        return bot.player.levels.getMax(skill)
    }
}
