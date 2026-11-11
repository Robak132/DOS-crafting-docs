# Audyt receptur na podstawie plików gry

Audyt źródłowych JSON-ów, przed rozwinięciem grup w widoku. Overhaul obejmuje bazowe DOS2 i dodatki moda. Dopasowania używają nazw gry, Stats ID i kategorii, bez podobieństwa tekstowego. Dopasowanie oznacza znalezienie zgodnej definicji, a nie pełną weryfikację działania gry. Ilości DOS1, efekty, zużywanie narzędzi, losowe wyniki i ulepszenia wyposażenia nie są w pełni sprawdzane. Brak dopasowania nie oznacza błędu. Opcjonalne Gift Bagi pominięto. Różne wyniki są kandydatami do oceny, nie automatycznym dowodem błędu.

| Katalog | Wpisy źródłowe | Definicje gry | Dopasowane | Rozbieżne ilości/wymagania | Inny wynik | Pozostałe do sprawdzenia |
|---|---:|---:|---:|---:|---:|---:|
| dos1 | 433 | 1481 | 386 | 1 | 1 | 45 |
| dos2 | 702 | 909 | 674 | 3 | 1 | 24 |
| dos2-overhaul | 1675 | 2370 | 1546 | 3 | 18 | 108 |

## dos1: przypadki do oceny

- **LEATHER CHEST**: Leather Scraps + Needle and Thread — `different_result`. 
  - `.pak-work/audit-current/dos1/Public/Shared/Stats/ItemCombos.txt:506` (`Public:506`). Wyniki: Homemade Leather Armour
  - `.pak-work/audit-current/dos1/Public/Shared/Stats/ItemCombos.txt:507` (`Public:507`). Wyniki: Handcrafted Leather Armour
- **MINOR POISON BOTTLE**: Empty Potion Bottle + Ooze Barrel — `mismatch`. requirements: catalog=Crafting 1, game=none
  - `.pak-work/audit-current/dos1/Public/Shared/Stats/ItemCombos.txt:748` (`Public:748`). Wyniki: Small Poison Bottle

## dos2: przypadki do oceny

- **Arrowhead**: #Cutting-Tool + Bone — `mismatch`. quantity: catalog=2, game=[5]
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:2946` (`CuttingTool_LOOT_Bone_A`). Wyniki: Arrowhead, Arrowhead
- **Arrowhead**: #Cutting-Tool + Sharp Piece Of Metal — `mismatch`. quantity: catalog=2, game=[3]
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:2931` (`CuttingTool_LOOT_MetalShard_A`). Wyniki: Arrowhead, Arrowhead
- **Arrowhead**: #Cutting-Tool + Sharp Rock — `mismatch`. quantity: catalog=2, game=[3]
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:2916` (`CuttingTool_LOOT_PieceOfRock_A`). Wyniki: Arrowhead, Arrowhead
- **Bucket**: Bucket with Milk + Empty Cup — `different_result`. 
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:9705` (`FUR_Bucket_A_Milk_CON_Drink_Cup_A_Empty`). Wyniki: Goggles, Milk

## dos2-overhaul: przypadki do oceny

- **Arrowhead**: #Cutting-Tool + Bone — `mismatch`. quantity: catalog=2, game=[5]
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:2946` (`CuttingTool_LOOT_Bone_A`). Wyniki: Arrowhead, Arrowhead
- **Arrowhead**: #Cutting-Tool + Sharp Piece Of Metal — `mismatch`. quantity: catalog=2, game=[3]
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:2931` (`CuttingTool_LOOT_MetalShard_A`). Wyniki: Arrowhead, Arrowhead
- **Arrowhead**: #Cutting-Tool + Sharp Rock — `mismatch`. quantity: catalog=2, game=[3]
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:2916` (`CuttingTool_LOOT_PieceOfRock_A`). Wyniki: Arrowhead, Arrowhead
- **Bucket**: Bucket with Milk + Empty Cup — `different_result`. 
  - `.pak-work/audit-current/dos2-Patch3/Public/Shared/Stats/Generated/ItemCombos.txt:9705` (`FUR_Bucket_A_Milk_CON_Drink_Cup_A_Empty`). Wyniki: Goggles, Milk
- **Empty Potion Bottle**: Plate + Oven — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:48` (`LOOT_Scraps_Empty_Potions_Plate1_Oven`). Wyniki: Empty Bottle
- **Empty Potion Bottle**: Plate + Oven — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:48` (`LOOT_Scraps_Empty_Potions_Plate1_Oven`). Wyniki: Empty Bottle
- **Random Blank Scroll**: Demon Altar + Sheet of Paper — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:7964` (`Book_CraftScroll_1`). Wyniki: Blank Water Scroll, Blank Fire Scroll, Blank Earth Scroll, Blank Air Scroll, Blank Necromancy Scroll, Blank Polymorph Scroll, Blank Summoning Scroll, Blank Warrior Scroll, Blank Ranger Scroll, Blank Rogue Scroll
- **Random Air Scroll**: Demon Altar + Blank Air Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8170` (`Book_RandomScroll_Air_1`). Wyniki: Teleportation Scroll, Shocking Touch Scroll, Favourable Wind Scroll, Pressure Spike Scroll, Electric Discharge Scroll, Dazing Bolt Scroll, Nether Swap Scroll, Apportation Scroll, Blinding Radiance Scroll
- **Random Earth Scroll**: Demon Altar + Blank Earth Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8118` (`Book_RandomScroll_Earth_1`). Wyniki: Worm Tremor Scroll, Reactive Armour Scroll, Poison Wave Scroll, Poison Dart Scroll, Mend Metal Scroll, Earthquake Scroll, Fossil Strike Scroll, Fortify Scroll, Impalement Scroll, Contamination Scroll
- **Random Fire Scroll**: Demon Altar + Blank Fire Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8066` (`Book_RandomScroll_Fire_1`). Wyniki: Supernova Scroll, Spontaneous Combustion Scroll, Laser Ray Scroll, Ignition Scroll, Haste Scroll, Fireball Scroll, Flaming Tongues Scroll, Searing Daggers Scroll, Fire Whip Scroll, Peace of Mind Scroll
- **Random Polymorph Scroll**: Demon Altar + Blank Polymorph Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8270` (`Book_RandomScroll_Polymorph_1`). Wyniki: Bull Horns Scroll, Chameleon Cloak Scroll, Chicken Claw Scroll, Summon Oily Blob Scroll, Medusa Head Scroll, Skin Graft Scroll, Spider Legs Scroll, Heart of Steel Scroll, Terrain Transmutation Scroll, Tentacle Lash Scroll, Spread Your Wings Scroll
- **Random Ranger Scroll**: Demon Altar + Blank Ranger Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8434` (`Book_RandomScroll_Ranger_1`). Wyniki: Elemental Arrowheads Scroll, First Aid Scroll, Ricochet Scroll, Sky Shot Scroll, Pindown Scroll, Reactive Shot Scroll, Marksman's Fang Scroll, Barrage Scroll, Glitter Dust Scroll, Tactical Retreat Scroll
- **Random Rogue Scroll**: Demon Altar + Blank Rogue Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8486` (`Book_RandomScroll_Rogue_1`). Wyniki: Backlash Scroll, Choloroform Scroll, Throwing Knife Scroll, Cloak and Dagger Scroll, Corrupted Blade Scroll, Gag Order Scroll, Rupture Tendons Scroll, Sawtooth Scroll, Sleeping Arms Scroll
- **Random Summoning Scroll**: Demon Altar + Blank Summoning Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8326` (`Book_RandomScroll_Summoning_1`). Wyniki: Charm Scroll, Dimensional Bolt Scroll, Rallying Cry Scroll, Conjure Incarnate Scroll, Planar Gateway Scroll, Shadow Infusion Scroll, Farsight Infusion Scroll, Power Infusion Scroll, Soul Mate Scroll, Supercharger Scroll, Elemental Totem Scroll
- **Random Warrior Scroll**: Demon Altar + Blank Warrior Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8382` (`Book_RandomScroll_Warrior_1`). Wyniki: Battering Ram Scroll, Battle Stomp Scroll, Crippling Blow Scroll, Whirlwind Scroll, Bouncing Shield Scroll, Enrage Scroll, Blitz Attack Scroll, Provoke Scroll, Phoenix Dive Scroll, Deflective Barrier Scroll
- **Random Water Scroll**: Demon Altar + Blank Water Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8022` (`Book_RandomScroll_Water_1`). Wyniki: Armour of Frost Scroll, Rain Scroll, Hail Strike Scroll, Restoration Scroll, Winter Blast Scroll, Ice Fan Scroll, Cryogenic Stasis Scroll, Soothing Cold Scroll
- **Random Witchcraft Scroll**: Demon Altar + Blank Witchcraft Scroll + Magic Inkpot & Quill — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:8218` (`Book_RandomScroll_Necromancy_1`). Wyniki: Blood Sucker Scroll, Raise Bloated Corpse Scroll, Shackles of Pain Scroll, Mosquito Swarm Scroll, Infect Scroll, Decaying Touch Scroll, Death Wish Scroll, Living on the Edge Scroll, Raise Bone Widow Scroll, Bone Cage Scroll
- **Silver Ore**: Plate + Oven — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:48` (`LOOT_Scraps_Empty_Potions_Plate1_Oven`). Wyniki: Empty Bottle
- **Random Lootbox Item**: Front Battle Lootbox + Scrapper's Pickaxe — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:23663` (`Open_Lootbox_FrontBattle_1`). Wyniki: Angel Wings/Beetle Wings, Blackring Shield, Blackring Magical Shield, Ghost Mace, Red Star Staff, Blue Star Staff, Phoenix wings, Halloween Mask, Barrel Armor/Halloween Barrel Armor, Ghost Helm/Halloween Ghost Helmet, Grunt Helmet, Pumpkin Helmet, Night Cape, Mistake's Staff/The Mistake, Goblin Pants
- **Random Lootbox Item**: Deffensive Global Lootbox + Scrapper's Pickaxe — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:23748` (`Open_Lootbox_DeffensiveGlobal_1`). Wyniki: Boar Tusks, Paladin Shield, Divine Shield, Scythe, Sickle, Ice Sword, Unique Warrior Boots, Unique Warrior Gloves, Unique Warrior Pants, Unique Warrior Torso, Unique Warrior Helmet, Goblin Pants, Mordus' Skull Ring/Skull Ring of Mordus, Demon Heart Ring, Merman Armor
- **Random Lootbox Item**: Watch Over Lootbox + Scrapper's Pickaxe — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:23833` (`Open_Lootbox_WatchOver_1`). Wyniki: Spider Legs, Estoc, Bifurcated Spear, Newworld Crossbow, Unique Ranger Boots, Unique Ranger Gloves, Unique Ranger Pants, Unique Ranger Torso, Unique Ranger Helmet, Ghost Shield, Teardrop Shield, Goblin Pants, Empress' Tiara/Tiara of the Empress, Queen's Sigil/Queen's Sigil Ring, Doctor's Water Ring
