import discord
from discord.ext import commands
import random
import os
import json
import urllib.request

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)

GUILD_ID = 1467528705587937330
REQUIRED_ROLE_ID = 1467530308214849662
API_URL = os.environ.get('API_URL', 'http://localhost:3000')
BOT_TOKEN = os.environ.get('DISCORD_TOKEN', '')

@bot.event
async def on_ready():
    print(f'Bot aktywny jako {bot.user}')
    guild = bot.get_guild(GUILD_ID)
    if guild:
        print(f'Serwer: {guild.name}')

@bot.command()
async def połącz(ctx):
    if ctx.guild.id != GUILD_ID:
        await ctx.send('❌ Ta komenda działa tylko na serwerze VexHack!')
        return
    
    member = ctx.author
    role = ctx.guild.get_role(REQUIRED_ROLE_ID)
    
    if role not in member.roles:
        await ctx.send('❌ Nie masz wymaganej roli!')
        return
    
    code = str(random.randint(100000, 999999))
    user_id = str(member.id)
    user_name = member.name
    
    try:
        data = json.dumps({
            'code': code,
            'discordId': user_id,
            'discordUsername': user_name,
            'discordRole': str(REQUIRED_ROLE_ID)
        }).encode()
        
        req = urllib.request.Request(
            f'{API_URL}/api/discord/code',
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        urllib.request.urlopen(req, timeout=10)
    except:
        pass
    
    await ctx.send(f'🔑 Twój kod weryfikacyjny: **{code}**\nWpisz go na stronie VexHack aby uzyskać dostęp!\n*Kod ważny 5 minut.*')
    print(f'✅ Kod dla {user_name}: {code}')

@bot.command()
async def help(ctx):
    await ctx.send(''''📖 Komendy:
!połącz - Generuje kod do połączenia ze stroną
''')

if BOT_TOKEN:
    bot.run(BOT_TOKEN)
else:
    print('⚠️ Ustaw DISCORD_TOKEN w zmiennych środowiskowych!')