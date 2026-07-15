// A company's URL key, derived from its (platform-unique) name so routing by name is unambiguous.
// Pure + dependency-free (no db, no node builtins) so it's safe in the client bundle, the web
// server, AND the executor. Uniqueness is enforced separately in server/naming.ts (needs the db).
export function slugify(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "company"
    );
}
