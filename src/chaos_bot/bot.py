import discord
import random
from discord.ext import commands

# --- 設定項目 ---
# 先ほどメモしたBotのトークン
TOKEN = 'MTQ2NzAzMDc2OTQ5ODMyNTEzNw.Gbd7uq.8MDyPrZ9qVosfLV_0psnvqpEVMU2C6SJj3ChUA'

# GitHub Pagesの画像が入っているフォルダのURL
# 末尾に / を忘れずに！
IMAGE_BASE_URL = 'https://39nagumo.github.io/CHAOS_Binds_Assets/'

# アップロードしたファイル名のリスト（例として3つ）
# 実際にあるファイル名に書き換えてください
BIND_IMAGES = [
    '01_KAY_O.jpg',
    'map_01_Ascent.png',
    'CHAOS_fix.png'
]
# ----------------

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'ログインしました: {bot.user.name}')

@bot.command()
async def chaos(ctx):
    # リストからランダムに1つ選択
    selected_image = random.choice(BIND_IMAGES)
    full_url = IMAGE_BASE_URL + selected_image
    
    # Discordに送信
    embed = discord.Embed(title="今日の縛り", color=0xff0000)
    embed.set_image(url=full_url)
    await ctx.send(embed=embed)

bot.run(TOKEN)