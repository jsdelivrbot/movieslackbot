
var env = require('node-env-file');
var rp = require('request-promise');
env(__dirname + '/.env');


if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
  // process.exit(1);
}

var Botkit = require('botkit');
var debug = require('debug')('botkit:main');
var Message = require('./commons/constructMessage.js');
var greetingKeywords = require('./commons/greetings.js');
var keywords = require('./commons/keywords.js');

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    // debug: true,
    scopes: ['bot'],
    // studio_token: process.env.studio_token,
    // studio_command_uri: process.env.studio_command_uri
};

// Use a mongo database if specified, otherwise store in a JSON file local to the app.
// Mongo is automatically configured when deploying to Heroku
if (process.env.MONGO_URI) {
    var mongoStorage = require('botkit-storage-mongo')({mongoUri: process.env.MONGO_URI});
    bot_options.storage = mongoStorage;
} else {
    bot_options.json_file_store = __dirname + '/.data/db/'; // store user data in a simple JSON format
}

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.slackbot(bot_options);

controller.startTicking();

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

if (!process.env.clientId || !process.env.clientSecret) {

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  webserver.get('/', function(req, res){
    res.render('installation', {
      studio_enabled: controller.config.studio_token ? true : false,
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })

  var where_its_at = 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me/';
  console.log('WARNING: This application is not fully configured to work with Slack. Please see instructions at ' + where_its_at);
}else {

  webserver.get('/', function(req, res){
    res.render('index', {
      domain: req.get('host'),
      protocol: req.protocol,
      glitch_domain:  process.env.PROJECT_DOMAIN,
      layout: 'layouts/default'
    });
  })
  // Set up a simple storage backend for keeping a record of customers
  // who sign up for the app via the oauth
  require(__dirname + '/components/user_registration.js')(controller);

  // Send an onboarding message when a new team joins
  require(__dirname + '/components/onboarding.js')(controller);

  // Load in some helpers that make running Botkit on Glitch.com better
  require(__dirname + '/components/plugin_glitch.js')(controller);

  // enable advanced botkit studio metrics
  require('botkit-studio-metrics')(controller);

  var normalizedPath = require("path").join(__dirname, "skills");
  require("fs").readdirSync(normalizedPath).forEach(function(file) {
    require("./skills/" + file)(controller);
  });

  // This captures and evaluates any message sent to the bot as a DM
  // or sent to the bot in the form "@bot message" and passes it to
  // Botkit Studio to evaluate for trigger words and patterns.
  // If a trigger is matched, the conversation will automatically fire!
  // You can tie into the execution of the script using the functions
  // controller.studio.before, controller.studio.after and controller.studio.validate
  if (process.env.studio_token) {
      controller.on('direct_message,direct_mention,mention', function(bot, message) {
          controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(function(convo) {
              if (!convo) {
                  // no trigger was matched
                  // If you want your bot to respond to every message,
                  // define a 'fallback' script in Botkit Studio
                  // and uncomment the line below.
                  // controller.studio.run(bot, 'fallback', message.user, message.channel);
              } else {
                  // set variables here that are needed for EVERY script
                  // use controller.studio.before('script') to set variables specific to a script
                  convo.setVar('current_time', new Date());
              }
          }).catch(function(err) {
              bot.reply(message, 'Well , I am not sure if I understand it correctly , try @moviebot help to know sample queries' +
                ' or you could try @moviebot info name_of_movie ');
          });
      });
    controller.hears(greetingKeywords,['message_received','direct_mention', 'mention', 'direct_message'],function(bot,message){
      bot.reply(message,message.text+' I am moviebot ,how can i help today? Type help to explore my skills');
    });
    controller.hears(keywords, ['message_received','direct_mention', 'mention', 'direct_message'], function (bot, message) {
      const movieName = message.text.match('(?<=info|movie|rating).*$')[0].trim();
      return rp('http://127.0.0.1:8000/api/movieDetails/' + movieName).then((msg) => {
        const jsonResponse = JSON.parse(msg);
        return bot.reply(message, {
          attachments:[
            {
              "text":`${Message.createMessage(jsonResponse)}`,
              "username": "moviebot",
              "mrkdwn": true
            }
          ]
        });

      }).catch(() => {
        bot.reply(message,'Well this is embarassing, we are summoming the software gods');
      });
    });

    controller.hears(['help','onboard me'], ['message_received','direct_mention', 'mention', 'direct_message'], function(bot,message) {
      bot.startConversation(message, function (err, convo) {

        convo.ask({
          attachments: [
            {
              title: 'Here are sample queries to begin with',
              callback_id: '123',
              attachment_type: 'default',
              actions: [
                {
                  "name": "Shawshank Redemption",
                  "text": "@moviebot movie Shawshank Redemption",
                  "value": "movie",
                  "type": "button",
                },
                {
                  "name": "Antwone Fisher",
                  "text": "@moviebot info Antwone Fisher",
                  "value": "info",
                  "type": "button",
                }
              ]
            }
          ]
        }, [
          {
            pattern: "movie",
            callback: function (reply, convo) {
              return rp('http://127.0.0.1:8000/api/movieDetails/shawshank redemption').then((msg) => {
                const jsonResponse = JSON.parse(msg);
                bot.reply(message, {
                  attachments:[
                    {
                      "text":`${Message.createMessage(jsonResponse)}`,
                      "username": "moviebot",
                      "mrkdwn": true
                    }
                  ]
                });

              }).catch(() => {
                bot.reply(message,'Well this is embarassing, we are summoning the software gods');
              });
            }
          },
          {
            pattern: "info",
            callback: function () {
              return rp('http://127.0.0.1:8000/api/movieDetails/Antwone Fisher').then((msg) => {
                const jsonResponse = JSON.parse(msg);
                bot.reply(message, {
                  attachments:[
                    {
                      "text":`${Message.createMessage(jsonResponse)}`,
                      "username": "moviebot",
                      "mrkdwn": true
                    }
                  ]
                });

              }).catch(() => {
                bot.reply(message,'Well this is embarassing, we are summoming the software gods');
              });
            }
          },
          {
            default: true,
            callback: function (reply, convo) {
              // do nothing
            }
          }
        ]);
      });

    });
  } else {
      console.log('~~~~~~~~~~');
      console.log('NOTE: Botkit Studio functionality has not been enabled');
      console.log('To enable, pass in a studio_token parameter with a token from https://studio.botkit.ai/');
  }
}





function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Botkit Starter Kit');
    console.log('Execute your bot application like this:');
    console.log('clientId=<MY SLACK CLIENT ID> clientSecret=<MY CLIENT SECRET> PORT=3000 studio_token=<MY BOTKIT STUDIO TOKEN> node bot.js');
    console.log('Get Slack app credentials here: https://api.slack.com/apps')
    console.log('Get a Botkit Studio token here: https://studio.botkit.ai/')
    console.log('~~~~~~~~~~');
}
