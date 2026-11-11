import { Item, type ItemData } from "./item"
import { Recipe } from "./recipe"

/** A group as stored in the generated catalog JSON. */
export type ItemGroupData = { id: string; name: string; members: ItemData[] }

/** The items an ingredient group stands for ("#Fish" → every fish), resolved during data generation. */
export class ItemGroup {
  declare id: string
  declare name: string
  declare members: Item[]

  constructor(data: ItemGroupData) {
    Object.assign(this, data)
    this.members = data.members.map(Item.from)
  }

  static from(this: void, data: ItemGroupData): ItemGroup {
    return data instanceof ItemGroup ? data : new ItemGroup(data)
  }

  /** Whether a member has this page. */
  includes(slug: string | undefined): boolean {
    return this.members.some((member) => member.slug === slug)
  }

  /** The recipes making its members; a member nothing makes gets a row of its own. */
  rows(recipes: Recipe[]): Recipe[] {
    return this.members.flatMap((item) => {
      const matches = recipes.filter((row) => !row.result.isGroup() && row.result.nameKey === item.nameKey)
      return matches.length
        ? matches
        : [
            new Recipe({
              id: `group:${this.id}:${item.nameKey}`,
              result: item,
              ingredients: [],
              tags: item.tags,
              requirements: "",
              notes: "",
              remarks: "",
              source: "",
            }),
          ]
    })
  }

  /** The members' English names, in order: two groups with the same list are the same group. */
  memberNames(): string {
    return JSON.stringify(this.members.map((member) => member.name))
  }
}

export type ItemGroups = Record<string, ItemGroup>
