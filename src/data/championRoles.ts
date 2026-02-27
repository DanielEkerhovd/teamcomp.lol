// Champion lane role mappings
// Manually maintained - update when new champions release

import { Role } from '../types';

export const CHAMPION_ROLES: Record<string, Role[]> = {

  // A
  Aatrox: ['top'],
  Ahri: ['mid'],
  Akali: ['mid', 'top'],
  Akshan: ['mid', 'top'],
  Alistar: ['support'],
  Ambessa: ['top', 'jungle'],
  Amumu: ['jungle', 'support'],
  Anivia: ['mid'],
  Annie: ['mid', 'support'],
  Aphelios: ['adc'],
  Ashe: ['adc', 'support'],
  AurelionSol: ['mid'],
  Aurora: ['mid', 'top'],
  Azir: ['mid'],

  // B
  Bard: ['support'],
  Belveth: ['jungle'],
  Blitzcrank: ['support'],
  Brand: ['support', 'mid'],
  Braum: ['support'],
  Briar: ['jungle'],

  // C
  Caitlyn: ['adc'],
  Camille: ['top'],
  Cassiopeia: ['mid'],
  Chogath: ['top', 'mid'],
  Corki: ['mid', 'adc'],

  // D
  Darius: ['top'],
  Diana: ['jungle', 'mid'],
  Draven: ['adc'],
  DrMundo: ['top', 'jungle'],

  // E
  Ekko: ['jungle', 'mid'],
  Elise: ['jungle'],
  Evelynn: ['jungle'],
  Ezreal: ['adc'],

  // F
  Fiddlesticks: ['jungle'],
  Fiora: ['top'],
  Fizz: ['mid'],

  // G
  Galio: ['mid', 'support'],
  Gangplank: ['top', 'mid'],
  Garen: ['top'],
  Gnar: ['top'],
  Gragas: ['jungle', 'top', 'support'],
  Graves: ['jungle'],
  Gwen: ['top'],

  // H
  Hecarim: ['jungle'],
  Heimerdinger: ['top', 'mid', 'support'],
  Hwei: ['mid', 'support'],

  // I
  Illaoi: ['top'],
  Irelia: ['top', 'mid'],
  Ivern: ['jungle'],

  // J
  Janna: ['support'],
  JarvanIV: ['jungle', 'top'],
  Jax: ['top', 'jungle'],
  Jayce: ['top', 'mid'],
  Jhin: ['adc'],
  Jinx: ['adc'],

  // K
  Kaisa: ['adc'],
  Kalista: ['adc'],
  Karma: ['support', 'mid'],
  Karthus: ['jungle', 'mid'],
  Kassadin: ['mid'],
  Katarina: ['mid'],
  Kayle: ['top', 'mid'],
  Kayn: ['jungle'],
  Kennen: ['top', 'mid'],
  Khazix: ['jungle'],
  Kindred: ['jungle'],
  Kled: ['top'],
  KogMaw: ['adc'],
  KSante: ['top'],

  // L
  Leblanc: ['mid'],
  LeeSin: ['jungle'],
  Leona: ['support'],
  Lillia: ['jungle', 'top'],
  Lissandra: ['mid'],
  Lucian: ['adc', 'mid'],
  Lulu: ['support'],
  Lux: ['support', 'mid'],

  // M
  Malphite: ['top', 'support'],
  Malzahar: ['mid'],
  Maokai: ['support', 'jungle', 'top'],
  MasterYi: ['jungle'],
  Mel: ['mid', 'support'],
  Milio: ['support'],
  MissFortune: ['adc'],
  MonkeyKing: ['jungle', 'top'],
  Mordekaiser: ['top'],
  Morgana: ['support', 'mid'],

  // N
  Naafiri: ['mid', 'jungle'],
  Nami: ['support'],
  Nasus: ['top'],
  Nautilus: ['support'],
  Neeko: ['mid', 'support'],
  Nidalee: ['jungle'],
  Nilah: ['adc'],
  Nocturne: ['jungle'],
  Nunu: ['jungle'],

  // O
  Olaf: ['jungle', 'top'],
  Orianna: ['mid'],
  Ornn: ['top'],

  // P
  Pantheon: ['support', 'top', 'mid'],
  Poppy: ['jungle', 'top', 'support'],
  Pyke: ['support'],

  // Q
  Qiyana: ['mid'],
  Quinn: ['top'],

  // R
  Rakan: ['support'],
  Rammus: ['jungle'],
  RekSai: ['jungle'],
  Rell: ['support'],
  Renata: ['support'],
  Renekton: ['top'],
  Rengar: ['jungle', 'top'],
  Riven: ['top'],
  Rumble: ['top', 'mid'],
  Ryze: ['mid', 'top'],

  // S
  Samira: ['adc'],
  Sejuani: ['jungle', 'top'],
  Senna: ['support', 'adc'],
  Seraphine: ['support', 'adc', 'mid'],
  Sett: ['top', 'support', 'jungle'],
  Shaco: ['jungle', 'support'],
  Shen: ['top', 'support'],
  Shyvana: ['jungle'],
  Singed: ['top'],
  Sion: ['top'],
  Sivir: ['adc'],
  Skarner: ['jungle'],
  Smolder: ['adc', 'mid'],
  Sona: ['support'],
  Soraka: ['support'],
  Swain: ['support', 'mid', 'adc'],
  Sylas: ['mid', 'top'],
  Syndra: ['mid'],

  // T
  TahmKench: ['top', 'support'],
  Taliyah: ['jungle', 'mid'],
  Talon: ['mid', 'jungle'],
  Taric: ['support'],
  Teemo: ['top'],
  Thresh: ['support'],
  Tristana: ['adc', 'mid'],
  Trundle: ['jungle', 'top'],
  Tryndamere: ['top'],
  TwistedFate: ['mid'],
  Twitch: ['adc'],

  // U
  Udyr: ['jungle', 'top'],
  Urgot: ['top'],

  // V
  Varus: ['adc'],
  Vayne: ['adc', 'top'],
  Veigar: ['mid', 'support'],
  Velkoz: ['support', 'mid'],
  Vex: ['mid'],
  Vi: ['jungle'],
  Viego: ['jungle'],
  Viktor: ['mid'],
  Vladimir: ['mid', 'top'],
  Volibear: ['jungle', 'top'],

  // W
  Warwick: ['jungle', 'top'],

  // X
  Xayah: ['adc'],
  Xerath: ['support', 'mid'],
  XinZhao: ['jungle'],

  // Y
  Yasuo: ['mid', 'top', 'adc'],
  Yone: ['mid', 'top'],
  Yorick: ['top'],
  Yunara: ['adc'],
  Yuumi: ['support'],

  // Z
  Zaahen: ['top', 'jungle'],
  Zac: ['jungle', 'top'],
  Zed: ['mid'],
  Zeri: ['adc'],
  Ziggs: ['mid', 'adc'],
  Zilean: ['support', 'mid'],
  Zoe: ['mid'],
  Zyra: ['support'],
};

// Get roles for a champion by ID
export function getChampionRoles(championId: string): Role[] {
  return CHAMPION_ROLES[championId] || [];
}

// Check if a champion plays a specific role
export function championPlaysRole(championId: string, role: Role): boolean {
  const roles = CHAMPION_ROLES[championId];
  return roles ? roles.includes(role) : false;
}
