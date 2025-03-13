/// Minecraft Bedrock Chat Logger (1.0.8)
///
/// A simple bot that logs chat messages and other events from a Bedrock server.
/// 
/// The server must have online-mode=false in server.properties (affects LAN only)
///
/// Minor annoyance: 
/// Anonymous LAN users are not persistent and can't be OPed.
/// The bot is immortal, immovable and doesn't attract creepers,
/// but will be visible in game on spawn.
/// The workaround is to switch it to spectator mode every time after connecting. 
///
/// > /gamemode spectator Server

/// How to start
/// 1) Install Node.js
/// 2) Browse to the folder with mc-bedrock-chatlog.js
/// 3) Run the following commands:
/// > npm i
/// > node mc-bedrock-chatlog.js -h 10.0.0.5 -p 19132

/// The bot will connect to the server and start logging chat messages.
/// All options:
/// -h, --host        Client address
/// -p, --port        Client port
/// -u, --username    Bot username
/// -l, --logFolder   Log folder
/// -x, --prefix      Log file prefix
/// -r, --retry       Keep retrying to connect
/// -i, --interval    Connection retry interval in seconds
/// --raw             Log raw packets as JSON
/// --motd            Send a whisper to players when they join
/// --motdAlone       Send additional whisper to players when they join and no other players are online

/// The bot will stop when a file named 'stop' is created in the bot's folder.

/// Check if the user installed dependencies
try
{
  require('yargs/yargs');
  require('yargs/helpers');
  require('bedrock-protocol');
  require('fs');
}
catch (error)
{
  if (error.code === 'MODULE_NOT_FOUND')
  {
    console.error('Required module not found. Please run "npm i" in this directory to install the missing dependencies.');
    process.exit(1);
  }
  else
  {
    throw error;
  }
}

/// Parse command line arguments
const yargs = require('yargs/yargs');
const {hideBin} = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).option('host', {
  alias: 'h',
  type: 'string',
  description: 'Client address',
  default: null
}).option('port', {
  alias: 'p',
  type: 'number',
  description: 'Client port',
  default: 19132
}).option('username', {
  alias: 'u',
  type: 'string',
  description: 'Bot username',
  default: 'Server'
}).option('logFolder', {
  alias: 'l',
  type: 'string',
  description: 'Log folder',
  default: './logs'
}).option('prefix', {
  alias: 'x',
  type: 'string',
  description: 'Log file prefix',
  default: 'chat-'
}).option('raw', {
  type: 'boolean',
  description: 'Log raw packets as JSON',
  default: false
}).option('retry', {
  alias: 'r',
  type: 'boolean',
  description: 'Keep retrying to connect',
  default: true
}).option('interval', {
  alias: 'i',
  type: 'number',
  description: 'Connection retry interval',
  default: 30
}).option('motd', {
  type: 'string',
  description: 'Send a whisper to players when they join',
  default: null
}).option('motdAlone', {
  type: 'string',
  description: 'Send additional whisper to players when they join and no other players are online',
  default: null
}).argv;

const host = argv.host;
const port = argv.port;
const username = argv.username;
const logFolder = argv.logFolder;
const prefix = argv.prefix;
const retry = argv.retry;
const interval = argv.interval * 1000;
const raw = argv.raw;
const stopSignalFile = 'stop';

if (host === null)
{
  console.log('Error: host is not specified.');
  console.log('Usage: node mc-bedrock-chatlog.js -h 127.0.0.1 [-p 19132]');
  process.exit(1);
}

/// Logging subsystem with rolling log files
const {createWriteStream, existsSync, unlinkSync, mkdirSync} = require('fs');
let logStream = null;
let lastLogDate = null;
let logFile = null;

function log(message)
{
  AllocateLogStream();
  console.log(`(${new Date().toLocaleTimeString()}) ${message}`);
  logStream.write(`(${new Date().toLocaleTimeString()}) ${message}\n`);
}

function GetDateStamp()
{
  return new Date().toISOString().slice(0, 10);
}

function AllocateLogStream()
{
  if (lastLogDate !== null && lastLogDate === GetDateStamp())
  {
    return;
  }

  logStream?.end();

  if (!existsSync(logFolder))
  {
    mkdirSync(logFolder, {recursive: true});
    log(`Log folder created.`);
  }

  lastLogDate = GetDateStamp();
  logFile = `${logFolder}/${prefix}${lastLogDate}.log`;
  logStream = createWriteStream(logFile, {flags: 'a'});
}

/// Check for stop signal
setInterval(checkForStopSignal, 1000);

/// Establish connection to the client
const {createClient} = require('bedrock-protocol');

let client = null;
let connected = false;
TryConnect();

function TryConnect()
{
  Connect();
  if (!connected && retry)
  {
    setTimeout(() => {
      if (!connected)
      {
        log(`Could not connect, retrying...`);
        TryConnect();
      }
    }, interval);
  }
}

function Connect()
{
  client?.close();
  log(`Connecting to ${host}:${port} as [${username}]...`);
  client = createClient({
    host: host,
    port: port,
    username: username,
    offline: true,
    skipPing: true
  });

  client.on('join', () => {
    connected = true;
    log(`Connected.`);
  });

  client.on('text', (packet) => {

    processChat(packet);
    processAnnouncements(packet);
    processConnections(packet);
    processPlayerActions(packet);
    processDeaths(packet);

  });

  /// reconnect on kick
  client.on('kick', (packet) => {

    if (packet.message === '%disconnect.kicked')
    {
      log(`Bot [${username}] was kicked from the server. (${packet.message})`);
    }

    if (packet.message === '%disconnect.timeout')
    {
      log(`Bot [${username}] was disconnected from the server. (${packet.message})`);
    }

    if (packet.message === 'disconnectionScreen.serverIdConflict')
    {
      log(`Bot [${username}] was already present on the server. (${packet.message})`);
    }

    if (connected)
    {
      connected = false;
      TryConnect();
    }
  });

  client.on('close', () => {
    if (connected)
    {
      log(`Server is stopping.`);
      connected = false;
      TryConnect();
    }
  });

  client.on('error', (error) => {
    log(`Connection error: ${error.message}`);
    if (connected)
    {
      connected = false;
      TryConnect();
    }
  });
}

/// log all raw packets as JSON if requested
if (raw)
{
  client.on('text', (packet) => {
    log(JSON.stringify(packet));
  });
}

/// process individual packet types
function processChat(packet)
{
  if (packet.type === 'chat')
  {
    // {"type":"chat","needs_translation":false,"source_name":"PlayerName","message":"Hello","xuid":"123456","platform_chat_id":"","filtered_message":""}

    log(`[${packet.source_name}] ${packet.message}`);
  }
}

function processAnnouncements(packet)
{
  if (packet.type === 'announcement')
  {
    // {"type":"announcement","needs_translation":false,"source_name":"Server","message":"[Server] test","xuid":"","platform_chat_id":"","filtered_message":""}
    log(`${packet.message}`);
  }
}

// roughly count players
let playerCount = 0;

function processConnections(packet)
{
  if (packet.type !== 'translation')
  {
    return;
  }

  if (packet.message === '§e%multiplayer.player.left')
  {
    // {"type":"translation","needs_translation":true,"message":"§e%multiplayer.player.left","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    log(`* [${packet.parameters[0]}] left the game.`);

    if (playerCount > 0)
    {
      playerCount--;
    }
  }

  if (packet.message === '§e%multiplayer.player.joined')
  {
    // {"type":"translation","needs_translation":true,"message":"§e%multiplayer.player.joined","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    log(`* [${packet.parameters[0]}] joined the game.`);

    playerCount++;

    /// send message of the day after player spawned
    if (argv.motd !== null || argv.motdAlone !== null)
    {
      setTimeout(() => {
        // whisper to the player after they spawned
        if (argv.motd !== null)
        {
          log(`/w "${packet.parameters[0]}" ${argv.motd}`);
          client.queue('command_request', {
            command: `/w "${packet.parameters[0]}" ${argv.motd}`,
            origin: {
              type: 'player',
              uuid: '',
              request_id: ''
            },
            internal: false,
            version: 52
          });
        }

        /// send special message when nobody is online
        if (argv.motdAlone !== null && playerCount === 1)
        {
          log(`/w "${packet.parameters[0]}" ${argv.motdAlone}`);
          client.queue('command_request', {
            command: `/w "${packet.parameters[0]}" ${argv.motdAlone}`,
            origin: {
              type: 'player',
              uuid: '',
              request_id: ''
            },
            internal: false,
            version: 52
          });
        }

      }, 6000);
    }

  }
}

function processPlayerActions(packet)
{
  if (packet.type !== 'translation')
  {
    return;
  }

  if (packet.message === 'multiplayer.playersSkippingNight')
  {
    // {"type":"translation","needs_translation":true,"message":"multiplayer.playersSkippingNight","parameters":[],"xuid":"","platform_chat_id":"","filtered_message":""}
    log(`* Players are skipping the night.`);
  }
}

function processDeaths(packet)
{
  if (packet.type !== 'translation')
  {
    return;
  }

  if (packet.message?.startsWith('death.'))
  {
    // {"type":"translation","needs_translation":true,"message":"death.fell.accident.generic","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    // {"type":"translation","needs_translation":true,"message":"death.attack.mob","parameters":["PlayerName","%entity.ghast.name"],"xuid":"","platform_chat_id":"","filtered_message":""}
    // {"type":"translation","needs_translation":true,"message":"death.attack.fall","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    // {"type":"translation","needs_translation":true,"message":"death.attack.player","parameters":["PlayerName","AttackerName"],"xuid":"","platform_chat_id":"","filtered_message":""}

    const playerName = packet.parameters.length > 0 ? packet.parameters[0] : null;
    let deathSource = packet.parameters.length > 1 ? packet.parameters[1] : null;
    if (deathSource?.startsWith('%entity.'))
    {
      // %entity.skeleton.name
      deathSource = deathSource.replace('%entity.', '');
      deathSource = deathSource.replace('.name', '');
    }

    let deathReason = packet.message;
    if (packet.message === 'death.fell.accident.generic')
    {
      deathReason = 'fell to their death';
    }

    if (packet.message === 'death.attack.mob')
    {
      deathReason = `was killed`;
    }

    if (packet.message === 'death.attack.fall')
    {
      deathReason = 'fell to their death while trying to escape';
    }

    if (packet.message === 'death.attack.player')
    {
      deathReason = `was killed by player`;
    }

    if (packet.message === 'death.attack.inFire')
    {
      deathReason = 'burned to death in fire';
    }

    if (packet.message === 'death.attack.wither')
    {
      deathReason = 'withered away';
    }

    if (packet.message === 'death.attack.starve')
    {
      deathReason = 'starved to death';
    }

    if (packet.message === 'death.attack.stalagmite')
    {
      deathReason = 'was impaled by a stalagmite';
    }

    if (packet.message === 'death.attack.magic')
    {
      deathReason = 'was killed by magic';
    }

    if (packet.message === 'death.attack.explosion')
    {
      deathReason = 'was blown up by an explosion';
    }

    if (packet.message === 'death.attack.cactus')
    {
      deathReason = 'was pricked to death';
    }

    if (packet.message === 'death.attack.lightningBolt')
    {
      deathReason = 'was struck by lightning';
    }

    if (packet.message === 'death.attack.dragonBreath')
    {
      deathReason = 'was killed by dragon breath';
    }

    if (packet.message === 'death.attack.drown')
    {
      deathReason = 'drowned';
    }

    if (packet.message === 'death.attack.dryout')
    {
      deathReason = 'dried out';
    }

    if (packet.message === 'death.attack.anvil')
    {
      deathReason = 'was squashed by a falling anvil';
    }

    if (packet.message === 'death.attack.fallingBlock')
    {
      deathReason = 'was squashed by a falling block';
    }

    if (packet.message === 'death.attack.fallingStalactite')
    {
      deathReason = 'was impaled by a falling stalactite';
    }

    if (packet.message === 'death.attack.flyIntoWall')
    {
      deathReason = 'flew into a wall';
    }

    if (packet.message === 'death.attack.freeze')
    {
      deathReason = 'froze to death';
    }

    if (packet.message === 'death.attack.fireball')
    {
      deathReason = 'was fireballed to death';
    }

    if (packet.message === 'death.attack.thorns')
    {
      deathReason = 'was killed by thorns';
    }

    if (packet.message === 'death.attack.cramming')
    {
      deathReason = 'was squished too much';
    }

    if (packet.message === 'death.attack.trident')
    {
      deathReason = 'was impaled by a trident';
    }

    if (packet.message === 'death.attack.potion')
    {
      deathReason = 'was killed by magic';
    }

    if (packet.message === 'death.attack.witherSkull')
    {
      deathReason = 'was killed by a wither skull';
    }

    if (packet.message === 'death.attack.lava')
    {
      deathReason = 'was burnt to a crisp whilst fighting';
    }

    if (packet.message === 'death.attack.arrow')
    {
      deathReason = 'was shot by arrow';
    }

    if (packet.message === 'death.attack.inWall')
    {
      deathReason = 'suffocated in a wall';
    }

    if (packet.message === 'death.attack.onFire')
    {
      deathReason = 'burned to death';
    }

    if (deathSource !== null)
    {
      deathReason = deathReason + ` caused by [${deathSource}]`;
    }

    log(`* [${playerName}] ${deathReason}.`);
  }
}

/// Stop signal handling
function checkForStopSignal()
{
  if (existsSync(stopSignalFile))
  {
    log('Stop signal received. Terminating the bot.');
    try
    {
      client?.disconnect('Bot stopped.');
    }
    catch
    {
      // ignore
    }

    try
    {
      client?.close();
    }
    catch
    {
      // ignore
    }

    try
    {
      logStream?.end();
    }
    catch
    {
      // ignore
    }

    unlinkSync(stopSignalFile);
    process.exit(0);
  }
}



