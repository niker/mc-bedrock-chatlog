/// Minecraft Bedrock Chat Logger (1.0.0)
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
/// -r, --raw         Log raw packets as JSON

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
const argv = yargs(hideBin(process.argv))
    // Server address
    .option('host', {
      alias: 'h',
      type: 'string',
      description: 'Client address',
      default: null
    })
    // Server port
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Client port',
      default: 19132
    })
    // Bot username
    .option('username', {
      alias: 'u',
      type: 'string',
      description: 'Bot username',
      default: 'Server'
    })
    // Log folder
    .option('logFolder', {
      alias: 'l',
      type: 'string',
      description: 'Log folder',
      default: './logs/'
    })
    // Log file prefix
    .option('prefix', {
      alias: 'x',
      type: 'string',
      description: 'Log file prefix',
      default: 'chat-'
    })
    // Log raw packet JSONs
    .option('raw', {
      alias: 'r',
      type: 'boolean',
      description: 'Log raw packets as JSON',
      default: false
    }).argv;

const host = argv.host;
const port = argv.port;
const username = argv.username;
const logFolder = argv.logFolder;
const prefix = argv.prefix;
const raw = argv.raw;

if (host === null)
{
  console.log('Error: host is not specified.');
  console.log('Usage: node mc-bedrock-chatlog.js -h 127.0.0.1 [-p 19132]');
  process.exit(1);
}

/// Establish connection to the client
const {createClient} = require('bedrock-protocol');
const {createWriteStream} = require('fs');

let client = null;
Connect();

function Connect()
{
  client?.close();
  client = createClient({

    host: host,
    port: port,
    username: username,
    offline: true

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

    setTimeout(Connect, 5000);

  });

  client.on('error', (packet) => {
    AllocateLogStream();
    logStream.write(JSON.stringify(packet) + '\n');
  });
}

/// Logging subsystem with rolling log files
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
  lastLogDate = GetDateStamp();
  logFile = `${logFolder}/${prefix}${lastLogDate}.log`;
  logStream = createWriteStream(logFile, {flags: 'a'});
}

/// log all raw packets as JSON if requested
if (raw)
{
  client.on('text', (packet) => {
    AllocateLogStream();
    logStream.write(JSON.stringify(packet) + '\n');
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
  }

  if (packet.message === '§e%multiplayer.player.joined')
  {
    // {"type":"translation","needs_translation":true,"message":"§e%multiplayer.player.joined","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    log(`* [${packet.parameters[0]}] joined the game.`);
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

  if (packet.message.startsWith('death.'))
  {
    // {"type":"translation","needs_translation":true,"message":"death.fell.accident.generic","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    // {"type":"translation","needs_translation":true,"message":"death.attack.mob","parameters":["PlayerName","%entity.ghast.name"],"xuid":"","platform_chat_id":"","filtered_message":""}
    // {"type":"translation","needs_translation":true,"message":"death.attack.fall","parameters":["PlayerName"],"xuid":"","platform_chat_id":"","filtered_message":""}
    // {"type":"translation","needs_translation":true,"message":"death.attack.player","parameters":["PlayerName","AttackerName"],"xuid":"","platform_chat_id":"","filtered_message":""}

    const playerName = packet.parameters.length > 0 ? packet.parameters[0] : null;
    const deathSource = packet.parameters.length > 1 ? packet.parameters[1] : null;
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
      deathReason = 'burned to death';
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

    if (deathSource !== null)
    {
      deathReason = deathReason + ` caused by [${deathSource}]`;
    }

    log(`* [${playerName}] ${deathReason}.`);
  }
}



