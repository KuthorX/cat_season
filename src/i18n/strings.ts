export const LOCALES = ['zh', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const zh = {
  'doc.title': '猫咪季节',
  'doc.shellLabel': '猫咪季节益智游戏',
  'doc.boardLabel': '猫咪季节棋盘',
  'doc.menuLabel': '开始菜单',
  'doc.hudLabel': '游戏状态',

  'menu.title': '猫咪季节',
  'menu.copy': '整理猫爪、小鱼和毛线，把窗边的小物一件件收好。',
  'menu.start': '开始游戏',

  'lang.toggleLabel': '切换语言',

  'hud.moves': '步数',
  'hud.score': '分数',
  'hud.round': '轮次',
  'hud.goalsLabel': '收集目标',
  'hud.powerupsLabel': '猫咪道具',
  'hud.restart': '重新开始',
  'hud.hint': '提示一步',

  'end.lostTitle': '猫咪睡着了',
  'end.wonTitle': '全部收好了',
  'end.score': '最终分数',
  'end.round': '到达轮次',
  'end.again': '再来一局',

  'result.won': '本局猫咪小物已经全部收好了。',
  'result.lost': '步数用完了，猫咪已经开始午睡。',

  'notice.snackUsed': '猫薄荷让猫咪又精神了一点，步数 +5。',
  'notice.autoShuffle': '没有可交换的一步，已自动打乱棋盘并赠送一个道具。',

  'tile.paw': '猫爪',
  'tile.fish': '小鱼',
  'tile.yarn': '毛线',
  'tile.bell': '铃铛',
  'tile.milk': '猫奶',
  'tile.cushion': '软垫',
  'tile.tuna': '金枪鱼',
  'tile.star': '星星',

  'powerup.snack.name': '猫薄荷',
  'powerup.snack.desc': '增加 5 步',
  'powerup.wand.name': '逗猫棒',
  'powerup.wand.desc': '清除一整行',
  'powerup.stamp.name': '爪印章',
  'powerup.stamp.desc': '清除一整列',
} as const;

export type StringId = keyof typeof zh;

const en: Record<StringId, string> = {
  'doc.title': 'Cat Season',
  'doc.shellLabel': 'Cat Season puzzle game',
  'doc.boardLabel': 'Cat Season board',
  'doc.menuLabel': 'Start menu',
  'doc.hudLabel': 'Game status',

  'menu.title': 'Cat Season',
  'menu.copy': 'Sort the paws, fish and yarn, and tuck every little treasure back by the window.',
  'menu.start': 'Play',

  'lang.toggleLabel': 'Switch language',

  'hud.moves': 'Moves',
  'hud.score': 'Score',
  'hud.round': 'Round',
  'hud.goalsLabel': 'Goals',
  'hud.powerupsLabel': 'Cat items',
  'hud.restart': 'Restart',
  'hud.hint': 'Show a hint',

  'end.lostTitle': 'Nap time',
  'end.wonTitle': 'All tucked away',
  'end.score': 'Final score',
  'end.round': 'Round reached',
  'end.again': 'Play again',

  'result.won': 'All the cat treasures are tucked away!',
  'result.lost': 'Out of moves. The cats have curled up for a nap.',

  'notice.snackUsed': 'Catnip perks the cats right up: +5 moves.',
  'notice.autoShuffle': 'No swaps left, so the board was reshuffled. Have a free item!',

  'tile.paw': 'Paws',
  'tile.fish': 'Fish',
  'tile.yarn': 'Yarn',
  'tile.bell': 'Bells',
  'tile.milk': 'Milk',
  'tile.cushion': 'Cushions',
  'tile.tuna': 'Tuna',
  'tile.star': 'Stars',

  'powerup.snack.name': 'Catnip',
  'powerup.snack.desc': '+5 moves',
  'powerup.wand.name': 'Feather Wand',
  'powerup.wand.desc': 'Clears a row',
  'powerup.stamp.name': 'Paw Stamp',
  'powerup.stamp.desc': 'Clears a column',
};

export const STRINGS: Record<Locale, Record<StringId, string>> = { zh, en };
