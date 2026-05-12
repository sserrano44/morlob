import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { withApi } from "@/lib/api/errors";
import { slugify } from "@/lib/core/ids";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createOrganizationSchema } from "@/lib/validation/schemas";

export async function GET() {
  return withApi(async () => {
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("organization_memberships")
      .select(
        "role, organizations(id, public_id, name, slug, status, created_at)"
      )
      .eq("user_id", actor.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      organizations:
        data?.map((row) => ({
          role: row.role,
          ...(Array.isArray(row.organizations)
            ? row.organizations[0]
            : row.organizations)
        })) ?? []
    });
  });
}

export async function POST(request: Request) {
  return withApi(async () => {
    const actor = await requireHumanActor();
    const input = createOrganizationSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const baseSlug = slugify(input.name);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: organization, error } = await supabase
      .from("organizations")
      .insert({
        name: input.name,
        slug
      })
      .select("id, public_id, name, slug, status, created_at")
      .single();

    if (error) {
      throw error;
    }

    const { error: membershipError } = await supabase
      .from("organization_memberships")
      .insert({
        organization_id: organization.id,
        user_id: actor.user.id,
        role: "owner"
      });

    if (membershipError) {
      throw membershipError;
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "organization.created",
      resourceType: "organization",
      resourceId: organization.id
    });

    await requireOrganizationForHuman(
      supabase,
      organization.public_id,
      actor.user.id
    );

    return NextResponse.json({ organization }, { status: 201 });
  });
}
