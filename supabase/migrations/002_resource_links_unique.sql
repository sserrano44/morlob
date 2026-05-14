create unique index if not exists resource_links_unique_relationship_idx
  on public.resource_links (
    workspace_id,
    source_resource_type,
    source_resource_id,
    target_resource_type,
    target_resource_id,
    relationship
  );
