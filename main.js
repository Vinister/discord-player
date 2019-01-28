const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json')
const search = require('youtube-search');
const fs = require('file-system')
const youtube = require('ytdl-core');
const ytlist = require('youtube-playlist-info');
var getYoutubeTitle = require('get-youtube-title')
delete config.default;
const getYotubePlaylistId = require('get-youtube-playlist-id')
const opts = {
  maxResults: 1,
  key: config.youtubekey,
  type: 'video'
};


client.login(config.token);
async function shuffle(a) { //скопипиженная функция со стаковерфлов для имитации шафла очереди
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}



async function playBroadcast() {
  controls.update(); //обновление списка после окончания трека
  if (queue.qu.songs.length > 0) { //Проверяем, если еще треки в очереди

    play_url = await youtube(queue.qu.songs[0].url, {
      filter: 'audioonly',
      liveBuffer: 0

    });


    await config.channel_voice.connection.playStream(play_url, {
      seek: 0,
      volume: 0.6,
      passes: 10
    })
    controls.update(); //обновление списка после начала для отображения громкости
    config.channel_voice.connection.dispatcher.on('end', async (reason) => {
      if (reason) { //Иногда причина бывает undefined и применение метода к ней вызывает ошибку, поэтому я добавил эту проверку, вообще можно убрать, но мне лень
        console.log(reason)
        if (reason.toLowerCase() === 'stop') {
          return
        }
        console.log('end')
        if (queue.repeat) { // Если включено зацикливание песни
          await playBroadcast()
          return
        }
        await queue.qu.songs.shift()
        await playBroadcast()
        return
      } else {
        console.log(reason)
        await queue.qu.songs.shift()
        await playBroadcast()
        return
      }
    });

    config.channel_voice.connection.on('ready', async () => {
      await controls.msg.member.voiceChannel.connection.dispatcher.pause() //хуй знает почему, но при смене региона оно только так продолжает работать
      await controls.msg.member.voiceChannel.connection.dispatcher.resume()
    })

  } else { //Если ничего не проигрывается, то ждем 50 секунд и вырубаем бота
    await setTimeout(() => {
      if (config.channel_voice) {
        if (queue.qu.songs.length < 1) {
          queue.stop(controls.msg)
          console.log('leave_empty')
        }
      } else {
        return
      }
    }, 50000)
  }
}




client.on('voiceStateUpdate', async (oldMember, newMember) => { //Если бот в войсе один, то ждем 50 сек и выходим 
  if (oldMember.guild.voiceConnection) {
    if (config.channel_voice && config.channel_voice.members.array().length < 2) {

      await setTimeout(() => {
        if (config.channel_voice && oldMember.guild.voiceConnection) {
          if (config.channel_voice.members.array().length < 2) {
            queue.stop(controls.msg)
            console.log('leave')
          } else {
            return
          }
        }
      }, 50000)
    }
  }
})



function controls__() {
  this.msg;
  this.init = async (channel) => {



    let reactions = ['▶', '⏸', '🔇', '🔉', '🔊', '⏭', '🔁', '🔀', '⏹']
    // let channel = client.channels.find('id', config.SoundChannel)
    let embed = {
      "plainText": 'Owner: ',
      "title": "",
      "description": "",
      "url": "",
      "color": 8340425,
      "author": {
        "name": "Сейчас проигрывается:",
        "url": ""
      }
    };
    if (config.owner) {
      embed.plainText = 'Owner: <@' + config.owner.id + '>'
    } else {
      embed.plainText = 'Owner: Public'
    }
    await channel.send(embed.plainText, {
      embed
    }).then(async (msg) => {
      this.msg = msg;
      // for (let i = 0; i < reactions.length; i++) {
      //   this.msg.react(reactions[i]);
      // }

      async function addreactions(i) {
        if (i == reactions.length) return;
        msg.react(reactions[i]).then(
          async () => {
            addreactions(i + 1)
          }
        )
      }
      await addreactions(0) // Только так получилось по порядку добавить эмоджи
      // reactions.forEach(async (emoji) => {
      //   await this.msg.react(emoji);
      // })

      this.msg.awaitReactions((reaction, user) => {
        if (!user.bot) reaction.remove(user);
        if (!user.bot && this.msg.guild.members.find('id', user.id).voiceChannel == config.channel_voice && (user == config.owner || !config.private)) {
          let emoji = reaction.emoji.name;
          if (this.msg.guild.voiceConnection.dispatcher) {



            if (emoji === reactions[0]) {
              queue.resume(this.msg)
              console.log('Play')
            }
            if (emoji === reactions[1]) {
              queue.pause(this.msg)
              console.log('Pause')
            }
            if (emoji === reactions[2]) {
              queue.mute(this.msg)
              console.log('Mute')
            }
            if (emoji === reactions[3]) {
              queue.volume(-0.1, this.msg)
              console.log('Volume decr')
            }
            if (emoji === reactions[4]) {
              queue.volume(0.1, this.msg)
              console.log('Volume incr')
            }
            if (emoji === reactions[5]) {
              queue.skip(this.msg)
              console.log('Skip')
            }
            if (emoji === reactions[6]) {
              queue.repeat = !queue.repeat;
              console.log('Repeat')
            }
            if (emoji === reactions[7]) {
              queue.shuffle(this.msg);
              console.log('Shuffle')
            }
          }
          if (emoji === reactions[8]) {
            queue.stop(this.msg);
            console.log('Stop')
          }
        }
      })
    })

  }
  this.update = async () => { //Обновляет плейлист
    let message = {
      "plainText": "",
      "title": "",
      "description": "",
      "url": "",
      "color": 8340425,
      "fields": [
        {
          "name": "\u200B",
          "value": "\u200B",
          "inline": true
        },
        {
          "name": "\u200B",
          "value": "\u200B",
          "inline": true
        }
      ],
      "footer": {
        "text": ""
      },
      "author": {
        "name": "Сейчас проигрывается:",
        "url": ""
      }
    };
    if (config.owner) {
      message.plainText = 'Owner: <@' + config.owner.id + '>'
    } else {
      message.plainText = 'Owner: Public'
    }
    for (let i = 0; i < queue.qu.songs.length; i++) {
      if (i < 11) {
        if (i === 0) {
          message.title = queue.qu.songs[i].title;
          message.url = queue.qu.songs[i].url;
          continue;
        }




        message.description += i + '. **[' + queue.qu.songs[i].title + '](' + queue.qu.songs[i].url + ')' + '** \n';
      } else {
        message.fields[0].value = ' ...Еще' + (queue.qu.songs.length - (i))

        break
      }
      if (this.msg.member.voiceChannel.connection.dispatcher) {
        message.fields[1].value = ' Громкость:' + parseInt((this.msg.member.voiceChannel.connection.dispatcher.volume * 100), 10) + '%'
      }
    }
    await this.msg.edit(message.plainText, {
      embed: message
    })
  }
}

function q() {
  this.qu = {
    "songs": []
  }
  this.shuffle = async () => {
    let current = this.qu.songs.shift()
    this.qu.songs = await shuffle(this.qu.songs);
    this.qu.songs.unshift(current);
    controls.update();
  }
  this.repeat = false;
  this.pause = async (message) => {
    await message.member.voiceChannel.connection.dispatcher.pause()
  }



  this.volume = async (i, message) => {
    let dispatcher = message.member.voiceChannel.connection.dispatcher

    await dispatcher.setVolume(dispatcher.volume + i)
    if (dispatcher.volume > 1) {
      await dispatcher.setVolume(1)
    }
    controls.update()
  }
  this.mute = async (message) => {
    let dispatcher = message.member.voiceChannel.connection.dispatcher
    if (dispatcher.volume == 0) {
      await dispatcher.setVolume(0)
    } else {
      await dispatcher.setVolume(1)
    }
    controls.update()
  }


  this.resume = async (message) => {
    await message.member.voiceChannel.connection.dispatcher.resume()
  }





  this.skip = async (message) => {
    await message.member.voiceChannel.connection.dispatcher.end('Skip')
  }




  //STOP

  this.stop = async (message) => {
    this.qu.songs = [];
    controls.update();
    if (message.member.voiceChannel.connection.dispatcher) {
      message.member.voiceChannel.connection.dispatcher.end('stop')
    }
    if (config.oldparent) {

      await config.channel_voice.setParent(config.oldparent)
      await config.channel_voice.setPosition(config.oldposition)
      config.oldparent = null;
      config.oldposition = null;
    }



    if (message.guild.voiceConnection) {
      await config.channel_voice.leave()
    }
    if (!config.public && config.private && config.channel_voice) {
      await config.channel_voice.delete('Music Bot')
    }
    config.channel_voice = null;
    if (config.channel) {
      await controls.msg.delete()
      controls.msg = null;
      await config.channel.delete('Music Bot')
      config.channel = null;
    }
    if (config.cat) {
      await config.cat.delete()
    }

    config.busy = false;
    config.private = false;
    config.public = false;

  }








  this.play = async function () {
    playBroadcast()
  }






  this.playlist = async function (message) {

    if (message.content.match(/^.*(\/playlist\?list=)([^#\&\?]*).*/)) {
      ytlist(config.youtubekey, getYotubePlaylistId(message.content)).then(res => {
        res = res.filter(function (n) {
          return n != undefined
        });
        let songs = []
        for (let i = 0; i < res.length; i++) {

          if (res[i].title === 'Private video') {
            continue;
          }
          let title = res[i].title;
          let url = 'https://www.youtube.com/watch?v=' + res[i].resourceId.videoId
          let song = {
            'title': title,
            'url': url
          }


          songs[i] = song
          if (songs.length == res.length) {
            songs = songs.filter(function (n) {
              return n != undefined
            });
            this.qu.songs = this.qu.songs.concat(songs);

            if (!message.guild.voiceConnection.dispatcher) {
              this.play()
            }
            controls.update()
          }



        }

      })



    } else if (message.content.match(/.*(?:(?:youtu.be\/)|(?:v\/)|(?:\/u\/\w\/)|(?:embed\/)|(?:watch\?))\??v?=?([^#\&\?]*).*/)) {
      getYoutubeTitle(youtube.getVideoID(message.content), config.youtubekey, (err, title) => {
        if (err) {
          return console.log(err)
        }
        if (!title) {
          return
        }
        if (title === 'Private video') {
          return;
        }
        let song = {
          'title': title,
          'url': message.content
        }
        this.qu.songs.push(song)
        if (!message.guild.voiceConnection.dispatcher) {
          this.play()
        }
        controls.update()

      })
    } else {
      await search(message.content, opts, async (err, results) => {
        if (err) return await message.channel.send('По этому запросу ничего не найдено').then((msg) => msg.delete(5))
        if (results[0].link) {
          let m = message;
          m.content = results[0].link
          this.playlist(m);
        }
      });
    }


  }
}

let queue = new q();
let controls = new controls__();

client.on('ready', async () => {
  console.log(client.user.username + ' Ready')
})
client.on('message', async (message) => {
  if (!message.guild) return;
  // if (message.channel.id === config.SoundChannel) {
  //   message.delete(5);
  // }
  if (message.author.bot) return;
  if (message.member.voiceChannel == config.channel_voice && message.channel == config.channel && (message.author == config.owner || !config.private)) {

    if (!message.member.voiceChannel.connection) {


      //message.member.voiceChannel.leave()
    }
    message.delete(5);
    queue.playlist(message)

    // 
  }

  if (message.content.indexOf(config.prefix) !== 0)
    return;
  args = message.content.toLowerCase().slice(config.prefix.length).trim().split(/ +/g);
  if (args != undefined) {
    cmd = args.shift();
  }
  if (cmd === 'ping') {
    console.log(config.channel_voice.connection)
    await message.channel.send('Ping : ' + Math.round(client.ping) + ' **ms**');
  }
  if (!config.busy) {
    if (cmd === 'create') {



      if (!args[0]) {
        if (message.member.voiceChannel) {

          config.cat = await message.guild.createChannel('🎵 ' + 'Музыка', 'category')

          config.cat.setPosition(4)
          config.channel_voice = message.member.voiceChannel;
          config.oldparent = config.channel_voice.parent
          config.oldposition = config.channel_voice.position
          config.channel = await message.guild.createChannel('🎵 ' + message.member.displayName + ' player', 'text');
          config.channel.setParent(config.cat)
          config.channel_voice.setParent(config.cat)
          await config.channel_voice.join()

          config.owner = message.author;
          config.busy = true;
          config.public = true;
          controls.init(config.channel)

        } else {
          await message.channel.send('<@' + message.author.id + '> **Вы должны быть в голосовом канале**').then(msg => msg.delete(10))
        }
      }


      if (args[0] === 'private') {
        config.channel = await message.guild.createChannel('🎵 ' + message.member.displayName + ' player', 'text', [{
            id: message.guild.defaultRole.id,
            deny: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'MANAGE_CHANNELS']
          },
          {
            id: message.member.id,
            allow: ['SEND_MESSAGES', 'VIEW_CHANNEL']
          }
        ])
        config.channel_voice = await message.guild.createChannel('🎵 ' + message.member.displayName + ' player', 'voice', [{
            id: message.guild.defaultRole.id,
            deny: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'MANAGE_CHANNELS']
          },
          {
            id: message.member.id,
            allow: ['SEND_MESSAGES', 'VIEW_CHANNEL']
          }
        ])
        config.cat = await message.guild.createChannel('🎵 ' + 'Музыка', 'category', [{
            id: message.guild.defaultRole.id,
            deny: ['SEND_MESSAGES', 'VIEW_CHANNEL', 'MANAGE_CHANNELS']
          },
          {
            id: message.member.id,
            allow: ['SEND_MESSAGES', 'VIEW_CHANNEL']
          }
        ])
        config.cat.setPosition(4)
        await config.channel_voice.join()

        config.owner = message.author
        config.busy = true;
        config.private = true;
        config.public = false;
        config.channel.setParent(config.cat)
        config.channel_voice.setParent(config.cat)
        controls.init(config.channel)
      }





      if (args[0] === 'public') {
        if (message.member.voiceChannel) {

          config.cat = await message.guild.createChannel('🎵 ' + 'Музыка', 'category')

          config.cat.setPosition(4)
          config.channel_voice = message.member.voiceChannel;
          config.oldparent = config.channel_voice.parent
          config.oldposition = config.channel_voice.position
          config.channel = await message.guild.createChannel('🎵 ' + message.member.displayName + ' player', 'text');
          config.channel.setParent(config.cat)
          config.channel_voice.setParent(config.cat)
          await config.channel_voice.join()

          config.owner = false;
          config.busy = true;
          config.private = false;
          config.public = false;
          controls.init(config.channel)

        } else {
          await message.channel.send('<@' + message.author.id + '> **Вы должны быть в голосовом канале**').then(msg => msg.delete(10))
        }
      }
    }
  }
})
// if (message.content === '/join') {
//  // Only try to join the sender's voice channel if they are in one themselves
//  if (message.member.voiceChannel) {
//     message.member.voiceChannel.join()
//      .then(connection => { // Connection is an instance of VoiceConnection
//         message.reply('I have successfully connected to the channel!');
//      }) 
//  } else {
//     message.reply('You need to join a voice channel first!');
//    }
//  }
//  if (message.content === '/leave') {

//    if (message.member.voiceChannel) {
//      message.member.voiceChannel.leave()
//    } else {
//      message.reply('You need to join a voice channel first!');
//   }
//  }