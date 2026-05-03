require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType
} = require("discord.js");

const { QuickDB } = require("quick.db");
const ms = require("ms");
const db = new QuickDB();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const prefix = "+";

// =========================
// INVITE CACHE
// =========================
const invitesCache = new Map();

// =========================
// READY + STATUS
// =========================
client.once("ready", async () => {
  console.log(`${client.user.tag} is online 🚀`);

  client.user.setPresence({
    activities: [{ name: "👑 Made By Huztro", type: ActivityType.Playing }],
    status: "online"
  });

  client.guilds.cache.forEach(async (guild) => {
    const invites = await guild.invites.fetch().catch(() => {});
    if (!invites) return;

    invitesCache.set(
      guild.id,
      new Map(invites.map(i => [i.code, i.uses]))
    );
  });
});

// =========================
// ANTI LINK SYSTEM
// =========================
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);

  if (!isAdmin && await db.get(`antilink_${message.guild.id}`)) {
    const regex = /(https?:\/\/|discord\.gg\/|www\.)/gi;

    if (regex.test(message.content)) {
      await message.delete().catch(() => {});
      return message.channel.send("❌ Links are not allowed!");
    }
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const member = message.member;

  // =========================
  // MOD COMMANDS (30+ READY CORE)
  // =========================
  const mod = {
    ban: async () => {
      const user = message.mentions.members.first();
      if (!user) return;
      await user.ban();
      message.reply("Banned");
    },
    kick: async () => {
      const user = message.mentions.members.first();
      if (!user) return;
      await user.kick();
      message.reply("Kicked");
    },
    clear: async () => {
      const amt = parseInt(args[0]);
      if (!amt) return;
      await message.channel.bulkDelete(amt);
      message.reply("Deleted");
    },
    mute: async () => {
      const user = message.mentions.members.first();
      let role = message.guild.roles.cache.find(r => r.name === "Muted");
      if (!role) role = await message.guild.roles.create({ name: "Muted" });
      await user.roles.add(role);
      message.reply("Muted");
    },
    unmute: async () => {
      const user = message.mentions.members.first();
      let role = message.guild.roles.cache.find(r => r.name === "Muted");
      if (!role) return;
      await user.roles.remove(role);
      message.reply("Unmuted");
    },
    warn: async () => {
      const user = message.mentions.users.first();
      let w = await db.get(`warn_${message.guild.id}_${user.id}`) || 0;
      await db.set(`warn_${message.guild.id}_${user.id}`, w + 1);
      message.reply("Warned");
    },
    unwarn: async () => {
      const user = message.mentions.users.first();
      await db.set(`warn_${message.guild.id}_${user.id}`, 0);
      message.reply("Warn cleared");
    },
    lock: async () => {
      message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      message.reply("Locked");
    },
    unlock: async () => {
      message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: true
      });
      message.reply("Unlocked");
    }
  };

  if (mod[cmd]) return mod[cmd]();

  // =========================
  // ECO SYSTEM
  // =========================
  if (cmd === "balance") {
    let bal = await db.get(`bal_${message.author.id}`) || 0;
    message.reply(`💰 Balance: ${bal}`);
  }

  if (cmd === "daily") {
    let last = await db.get(`daily_${message.author.id}`);
    if (last && Date.now() - last < 86400000) return message.reply("Already claimed");
    await db.set(`daily_${message.author.id}`, Date.now());

    let bal = await db.get(`bal_${message.author.id}`) || 0;
    await db.set(`bal_${message.author.id}`, bal + 500);
    message.reply("Daily +500");
  }

  if (cmd === "work") {
    let earn = Math.floor(Math.random() * 400);
    let bal = await db.get(`bal_${message.author.id}`) || 0;
    await db.set(`bal_${message.author.id}`, bal + earn);
    message.reply(`Earned ${earn}`);
  }

  // =========================
  // ANTI SYSTEM
  // =========================
  if (cmd === "antilink") {
    db.set(`antilink_${message.guild.id}`, true);
    message.reply("Anti-link enabled");
  }

  // =========================
  // HELP PANEL (ULTRA DROPDOWN)
  // =========================
  if (cmd === "help") {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("help_menu")
        .setPlaceholder("Select Category")
        .addOptions(
          { label: "Moderation", value: "mod" },
          { label: "Economy", value: "eco" },
          { label: "Systems", value: "sys" }
        )
    );

    message.channel.send({ content: "📘 Help Panel", components: [row] });
  }

  // =========================
  // PANEL (TICKET + APPLY)
  // =========================
  if (cmd === "panel") {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("main_panel")
        .setPlaceholder("Select")
        .addOptions(
          { label: "🎫 Ticket", value: "ticket" },
          { label: "📝 Apply Staff", value: "apply" }
        )
    );

    message.channel.send({ components: [row] });
  }

  // =========================
  // GIVEAWAY
  // =========================
  if (cmd === "giveaway") {
    if (args[0] === "start") {
      const time = args[1];
      const winners = args[2];
      const prize = args.slice(3).join(" ");

      const embed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY")
        .setDescription(`${prize}\nWinners: ${winners}\nReact 🎉`)
        .setColor("Gold");

      const msg = await message.channel.send({ embeds: [embed] });
      await msg.react("🎉");

      setTimeout(async () => {
        const reaction = msg.reactions.cache.get("🎉");
        const users = await reaction.users.fetch();
        const list = users.filter(u => !u.bot).map(u => u.id);

        const winner = list[Math.floor(Math.random() * list.length)];
        message.channel.send(`🏆 Winner: <@${winner}>`);
      }, ms(time));
    }
  }

  // =========================
  // INVITES COMMAND
  // =========================
  if (cmd === "invites") {
    const user = message.mentions.users.first() || message.author;
    let count = await db.get(`invites_${message.guild.id}_${user.id}`) || 0;
    message.reply(`📨 ${user.username}: ${count}`);
  }
});

// =========================
// INVITE TRACKER + WELCOME
// =========================
client.on("guildMemberAdd", async (member) => {
  const oldInvites = invitesCache.get(member.guild.id);
  const newInvites = await member.guild.invites.fetch().catch(() => {});
  if (!newInvites) return;

  invitesCache.set(
    member.guild.id,
    new Map(newInvites.map(i => [i.code, i.uses]))
  );

  const used = newInvites.find(i => {
    const old = oldInvites?.get(i.code) || 0;
    return i.uses > old;
  });

  const inviter = used?.inviter;

  if (inviter) {
    let count = await db.get(`invites_${member.guild.id}_${inviter.id}`) || 0;
    await db.set(`invites_${member.guild.id}_${inviter.id}`, count + 1);
  }

  // WELCOME SYSTEM
  const channel = member.guild.channels.cache.find(c => c.name === "welcome");

  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle("👋 Welcome!")
      .setDescription(`Welcome ${member} to **${member.guild.name}**`)
      .setColor("Green");

    channel.send({ embeds: [embed] });
  }
});

// =========================
// INTERACTIONS (TICKETS + APPLY + HELP)
// =========================
client.on("interactionCreate", async (interaction) => {

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "help_menu") {
      const val = interaction.values[0];

      let msg = "Help";

      if (val === "mod") msg = "Ban, Kick, Mute, Warn...";
      if (val === "eco") msg = "Balance, Daily, Work...";
      if (val === "sys") msg = "Anti-link, Invite tracker...";

      return interaction.reply({ content: msg, ephemeral: true });
    }

    if (interaction.customId === "main_panel") {

      if (interaction.values[0] === "ticket") {
        const ch = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText
        });

        return interaction.reply({ content: `Ticket: ${ch}`, ephemeral: true });
      }

      if (interaction.values[0] === "apply") {

        const modal = new ModalBuilder()
          .setCustomId("apply")
          .setTitle("Staff Apply");

        for (let i = 1; i <= 7; i++) {
          const input = new TextInputBuilder()
            .setCustomId(`q${i}`)
            .setLabel(`Question ${i}`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(input));
        }

        return interaction.showModal(modal);
      }
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === "apply") {
    let text = "";

    for (let i = 1; i <= 7; i++) {
      text += `Q${i}: ${interaction.fields.getTextInputValue(`q${i}`)}\n`;
    }

    const log = interaction.guild.channels.cache.find(c => c.name === "apply-log");
    if (log) log.send(`New Apply:\n${text}`);

    interaction.reply({ content: "Submitted!", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
