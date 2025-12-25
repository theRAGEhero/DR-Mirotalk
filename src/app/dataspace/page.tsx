import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DataspaceClient } from "@/app/dataspace/DataspaceClient";

export default async function DataspacePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const personalDataspace = await prisma.dataspace.findFirst({
    where: { personalOwnerId: session.user.id },
    include: {
      createdBy: { select: { email: true } },
      members: {
        include: { user: { select: { email: true } } }
      },
      meetings: { select: { id: true } }
    }
  });

  const ensuredPersonal =
    personalDataspace ??
    (await prisma.dataspace.create({
      data: {
        name: "My Data Space",
        description: "Private dataspace owned by you.",
        createdById: session.user.id,
        personalOwnerId: session.user.id,
        isPrivate: true,
        members: {
          create: {
            userId: session.user.id
          }
        }
      },
      include: {
        createdBy: { select: { email: true } },
        members: {
          include: { user: { select: { email: true } } }
        },
        meetings: { select: { id: true } }
      }
    }));

  const dataspaces = await prisma.dataspace.findMany({
    where: { isPrivate: false },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { email: true } },
      members: {
        include: { user: { select: { email: true } } }
      },
      meetings: { select: { id: true } }
    }
  });

  const payload = dataspaces.map((space) => ({
    id: space.id,
    name: space.name,
    description: space.description,
    createdByEmail: space.createdBy.email,
    members: space.members.map((member) => ({
      id: member.userId,
      email: member.user.email
    })),
    isPrivate: space.isPrivate,
    meetingsCount: space.meetings.length
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "var(--font-serif)" }}>
          Dataspace
        </h1>
        <p className="text-sm text-slate-600">
          Create a shared dataspace or join an existing one.
        </p>
      </div>
      <DataspaceClient
        initialDataspaces={payload}
        currentUserId={session.user.id}
        personalDataspace={{
          id: ensuredPersonal.id,
          name: ensuredPersonal.name,
          description: ensuredPersonal.description,
          createdByEmail: ensuredPersonal.createdBy.email,
          members: ensuredPersonal.members.map((member) => ({
            id: member.userId,
            email: member.user.email
          })),
          isPrivate: ensuredPersonal.isPrivate,
          meetingsCount: ensuredPersonal.meetings.length
        }}
      />
    </div>
  );
}
