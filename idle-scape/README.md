# Idle Scape

An idle-game mod of the open-source [Void](https://github.com/GregHib/void) 2011 RuneScape server emulator (BSD-3-Clause).
Log in and a menu in the chat box lets you pick skilling and combat spots (blue = you can do it now), manage bots that
share your bank, and view your bank. Type `::menu` to bring the menu back.

## Run it
GitHub cannot run the game for you (it is a Java server). Download it and run it on your own computer:

1. Install Java 21 (https://adoptium.net).
2. Build: `cd server && gradlew :game:shadowJar -x test`
3. Put the game cache in `server/data/cache/`. To let Void download it on first start instead, set `storage.cache.download.url=https://dl.00002011.xyz/cache.zip` in `server/game.properties` (it is blank here so the game never goes online by itself).
4. Start: `cd server && java -jar game/build/libs/void-server-dev.jar`
5. Open http://localhost:8080/play.html?world=1 and log in with account name `Idle` for admin rights.

The RuneScape cache (art, models) belongs to Jagex and is not included in this repository.
