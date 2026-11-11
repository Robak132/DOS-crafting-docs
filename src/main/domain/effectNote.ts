const EFFECT_PHRASES: Array<[RegExp, string]> = [
  [/\bScales With Intelligence\b/gi, "Skaluje się z Inteligencją"],
  [/\bScales With Constitution\b/gi, "Skaluje się z Kondycją"],
  [/\bStats Increase with Crafting Level\b/gi, "Statystyki rosną z poziomem Craftingu"],
  [/\bStats Increase with Blacksmithing Level\b/gi, "Statystyki rosną z poziomem Blacksmithing"],
  [/\bStats Increase with Hero Level\b/gi, "Statystyki rosną z poziomem bohatera"],
  [/\bAdd\b/gi, "Dodaje"],
]

const EFFECT_WORDS: Array<[RegExp, string]> = [
  [/\bIntelligence\b/gi, "Inteligencja"],
  [/\bStrength\b/gi, "Siła"],
  [/\bFinesse\b/gi, "Finezja"],
  [/\bConstitution\b/gi, "Kondycja"],
  [/\bMemory\b/gi, "Pamięć"],
  [/\bWits\b/gi, "Bystrość"],
  [/\bSpeed\b/gi, "Szybkość"],
  [/\bInitiative\b/gi, "Inicjatywa"],
  [/\bMovement\b/gi, "Ruch"],
  [/\bHeal\b/gi, "leczenie"],
  [/\bPoison Resist\b/gi, "odporność na truciznę"],
  [/\bEarth Resist\b/gi, "odporność na ziemię"],
  [/\bAir Resist\b/gi, "odporność na powietrze"],
  [/\bFire Resist\b/gi, "odporność na ogień"],
  [/\bWater Resist\b/gi, "odporność na wodę"],
  [/\bResist-All\b/gi, "odporność na wszystko"],
  [/\bLucky Charm\b/gi, "Szczęście"],
  [/\bLoremaster\b/gi, "Znawca"],
  [/\bDrunk chance\b/gi, "szansa na upicie"],
  [/\bPoison chance\b/gi, "szansa na truciznę"],
  [/\bTurns\b/gi, "tury"],
]

/** A saved effect note of a recipe ("Add Loremaster"), in English as written in the data. */
export class EffectNote {
  /**
   * @param text the note as written
   * @param vocabulary the game's own Polish words for its terms (lowercase English → Polish)
   */
  constructor(
    private readonly text: string,
    private readonly vocabulary: Record<string, string> = {},
  ) {}

  /** Czytelny opis efektu przedmiotu — lekkie tłumaczenie EN→PL; "" for an empty note or "-". */
  polish(): string {
    const trimmed = this.text.trim()
    if (!trimmed || trimmed === "-") return ""
    let text = trimmed
    for (const [pattern, replacement] of EFFECT_PHRASES) text = text.replace(pattern, replacement)
    for (const [pattern, replacement] of EFFECT_WORDS)
      text = text.replace(pattern, (match) => this.vocabulary[match.toLocaleLowerCase()] ?? replacement)
    // A percentage takes the genitive: "+10% leczenia", "+15% odporności na ogień".
    text = text
      .replace(/(\d%) leczenie(?!\p{L})/gu, "$1 leczenia")
      .replace(/(\d%) odporność(?!\p{L})/gu, "$1 odporności")
    return text.replace(/\s+/g, " ").trim()
  }
}
