import { prisma } from "./prisma";

// Competence tags (§7) — freely defined by the owner, no hardcoded categories.
// Used to qualify who gets notified about an open shift / swap request.

export async function listTags(restaurantId: string) {
  return prisma.tag.findMany({
    where: { restaurantId },
    orderBy: { name: "asc" },
  });
}

/** Find-or-create tags by name for a restaurant; returns their ids. */
export async function upsertTagsByName(
  restaurantId: string,
  names: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const tag = await prisma.tag.upsert({
      where: { restaurantId_name: { restaurantId, name } },
      create: { restaurantId, name },
      update: {},
    });
    ids.push(tag.id);
  }
  return ids;
}

export async function deleteTag(
  tagId: string,
  restaurantId: string,
): Promise<boolean> {
  const result = await prisma.tag.deleteMany({
    where: { id: tagId, restaurantId },
  });
  return result.count > 0;
}

/** Replace a member's full tag set within a restaurant (others untouched). */
export async function setMemberTags(
  userId: string,
  restaurantId: string,
  tagIds: string[],
): Promise<void> {
  const restaurantTagIds = new Set(
    (await listTags(restaurantId)).map((t) => t.id),
  );
  const validIds = tagIds.filter((id) => restaurantTagIds.has(id));

  await prisma.$transaction([
    prisma.employeeTag.deleteMany({
      where: { userId, tagId: { in: Array.from(restaurantTagIds) } },
    }),
    prisma.employeeTag.createMany({
      data: validIds.map((tagId) => ({ userId, tagId })),
      skipDuplicates: true,
    }),
  ]);
}
