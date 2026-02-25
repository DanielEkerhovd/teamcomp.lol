// Champion lane role mappings
// Manually maintained - update when new champions release

import { Role } from '../types';

export const CHAMPION_ROLES: Record<string, Role[]> = {

  // A
  Aatrox: ['top'],
  Ahri: ['mid', 'jungle'],
  Akali: ['mid', 'jungle'],
  Akshan: ['adc', 'mid', 'jungle'],
  Alistar: ['support'],
  Ambessa: ['top', 'jungle'],
  Amumu: ['support'],
  Anivia: ['mid'],
  Annie: ['support'],
  Aphelios: ['adc'],
  Ashe: ['adc'],
  AurelionSol: ['mid'],
  Aurora: ['mid', 'jungle'],
  Azir: ['adc'],

  // B
  Bard: ['support'],
  Belveth: ['top'],
  Blitzcrank: ['support'],
  Brand: ['support', 'mid', 'jungle'],
  Braum: ['support'],
  Briar: ['mid', 'jungle'],

  // C
  Caitlyn: ['adc'],
  Camille: ['top'],
  Cassiopeia: ['mid'],
  Chogath: ['mid', 'top', 'jungle'],
  Corki: ['mid', 'adc'],

  // D
  Darius: ['top', 'jungle'],
  Diana: ['mid', 'jungle'],
  Draven: ['adc'],
  DrMundo: ['top', 'jungle'],

  // E
  Ekko: ['mid', 'jungle'],
  Elise: ['mid', 'jungle'],
  Evelynn: ['mid', 'jungle'],
  Ezreal: ['adc'],

  // F
  Fiddlesticks: ['support'],
  Fiora: ['mid', 'jungle'],
  Fizz: ['mid', 'jungle'],

  // G
  Galio: ['mid', 'top', 'jungle'],
  Gangplank: ['top'],
  Garen: ['top', 'jungle'],
  Gnar: ['top', 'jungle'],
  Gragas: ['jungle', 'top', 'mid'],
  Graves: ['adc'],
  Gwen: ['top', 'jungle'],

  // H
  Hecarim: ['top', 'jungle'],
  Heimerdinger: ['top', 'mid', 'support'],
  Hwei: ['support'],

  // I
  Illaoi: ['top', 'jungle'],
  Irelia: ['mid', 'jungle'],
  Ivern: ['support'],

  // J
  Janna: ['support'],
  JarvanIV: ['top', 'jungle'],
  Jax: ['top'],
  Jayce: ['adc', 'top'],
  Jhin: ['adc'],
  Jinx: ['adc'],

  // K
  Kaisa: ['adc'],
  Kalista: ['adc'],
  Karma: ['support', 'mid', 'top'],
  Karthus: ['jungle', 'mid'],
  Kassadin: ['mid', 'jungle'],
  Katarina: ['mid', 'jungle'],
  Kayle: ['adc'],
  Kayn: ['mid', 'jungle'],
  Kennen: ['mid'],
  Khazix: ['mid', 'jungle'],
  Kindred: ['adc'],
  Kled: ['top'],
  KogMaw: ['adc'],
  KSante: ['top', 'jungle'],

  // L
  Leblanc: ['mid', 'jungle'],
  LeeSin: ['mid', 'jungle'],
  Leona: ['support'],
  Lillia: ['mid', 'top'],
  Lissandra: ['mid'],
  Lucian: ['adc', 'mid'],
  Lulu: ['support'],
  Lux: ['support'],

  // M
  Malphite: ['mid', 'top', 'jungle'],
  Malzahar: ['mid'],
  Maokai: ['support', 'jungle', 'top'],
  MasterYi: ['mid', 'jungle'],
  Mel: ['mid', 'support'],
  Milio: ['support'],
  MissFortune: ['adc'],
  MonkeyKing: ['top', 'jungle'],
  Mordekaiser: ['mid', 'top'],
  Morgana: ['support', 'mid', 'jungle'],

  // N
  Naafiri: ['mid', 'jungle'],
  Nami: ['support'],
  Nasus: ['top', 'jungle'],
  Nautilus: ['support'],
  Neeko: ['support'],
  Nidalee: ['mid', 'jungle'],
  Nilah: ['mid', 'jungle'],
  Nocturne: ['mid', 'jungle'],
  Nunu: ['mid', 'top', 'jungle'],

  // O
  Olaf: ['top', 'jungle'],
  Orianna: ['support'],
  Ornn: ['top', 'jungle'],

  // P
  Pantheon: ['top', 'mid', 'jungle', 'support'],
  Poppy: ['top', 'jungle'],
  Pyke: ['support', 'mid', 'jungle'],

  // Q
  Qiyana: ['mid', 'jungle'],
  Quinn: ['adc', 'mid', 'jungle'],

  // R
  Rakan: ['support'],
  Rammus: ['top', 'jungle'],
  RekSai: ['top', 'jungle'],
  Rell: ['support'],
  Renata: ['support'],
  Renekton: ['top', 'jungle'],
  Rengar: ['mid', 'jungle'],
  Riven: ['mid', 'jungle'],
  Rumble: ['mid', 'top'],
  Ryze: ['mid'],

  // S
  Samira: ['adc', 'mid', 'jungle'],
  Sejuani: ['top', 'jungle'],
  Senna: ['adc'],
  Seraphine: ['support', 'adc', 'mid'],
  Sett: ['top', 'support', 'jungle'],
  Shaco: ['mid', 'jungle'],
  Shen: ['top', 'support'],
  Shyvana: ['jungle'],
  Singed: ['mid', 'top', 'jungle'],
  Sion: ['top', 'jungle'],
  Sivir: ['adc'],
  Skarner: ['top', 'jungle'],
  Smolder: ['adc', 'mid', 'top'],
  Sona: ['support'],
  Soraka: ['support'],
  Swain: ['support', 'mid', 'adc'],
  Sylas: ['mid', 'jungle'],
  Syndra: ['mid'],

  // T
  TahmKench: ['support'],
  Taliyah: ['mid', 'jungle'],
  Talon: ['mid', 'jungle'],
  Taric: ['support'],
  Teemo: ['adc'],
  Thresh: ['support'],
  Tristana: ['adc', 'mid'],
  Trundle: ['top', 'jungle'],
  Tryndamere: ['mid', 'jungle'],
  TwistedFate: ['mid', 'adc', 'top'],
  Twitch: ['adc', 'mid', 'jungle'],

  // U
  Udyr: ['top', 'jungle'],
  Urgot: ['top', 'jungle'],

  // V
  Varus: ['adc'],
  Vayne: ['adc', 'mid', 'jungle'],
  Veigar: ['mid', 'support'],
  Velkoz: ['support'],
  Vex: ['mid'],
  Vi: ['mid', 'jungle'],
  Viego: ['mid', 'jungle'],
  Viktor: ['mid'],
  Vladimir: ['mid', 'top'],
  Volibear: ['top', 'jungle'],

  // W
  Warwick: ['jungle', 'top'],

  // X
  Xayah: ['adc'],
  Xerath: ['support'],
  XinZhao: ['top', 'jungle'],

  // Y
  Yasuo: ['mid', 'top', 'adc'],
  Yone: ['mid', 'top'],
  Yorick: ['top', 'jungle'],
  Yunara: ['adc'],
  Yuumi: ['support'],

  // Z
  Zaahen: ['top', 'jungle'],
  Zac: ['top', 'jungle'],
  Zed: ['mid', 'jungle'],
  Zeri: ['adc'],
  Ziggs: ['mid', 'adc'],
  Zilean: ['support'],
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
