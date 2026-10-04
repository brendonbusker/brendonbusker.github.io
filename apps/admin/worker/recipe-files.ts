import { isAllowedRepositoryPath } from "@brendon/shared";

const directory = "apps/site/src/content/recipes";
const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;

// Read the tree and its text blobs together: hundreds of recipes still use one
// GitHub subrequest. The returned oid is the blob SHA used by Contents updates.
// GitHub documents Tree.entries, Blob.text/isTruncated and fine-grained token
// support at /en/graphql/reference/git and /en/graphql/guides/forming-calls-with-graphql.
const query = `query RecipeLibrary($owner: String!, $name: String!, $parent: String!, $recipes: String!) {
  repository(owner: $owner, name: $name) {
    parent: object(expression: $parent) {
      __typename
      ... on Tree { entries { name } }
    }
    recipes: object(expression: $recipes) {
      __typename
      ... on Tree {
        entries {
          name type oid
          object { __typename ... on Blob { text isTruncated } }
        }
      }
    }
  }
}`;

interface RecipeTree {
  __typename: string;
  entries?: Array<{
    name: string;
    type: string;
    oid: string;
    object?: {
      __typename: string;
      text?: string | null;
      isTruncated?: boolean;
    } | null;
  }> | null;
}
interface RecipeLibraryResponse {
  errors?: unknown[];
  data?: {
    repository?: {
      parent?: {
        __typename: string;
        entries?: Array<{ name: string }> | null;
      } | null;
      recipes?: RecipeTree | null;
    } | null;
  };
}

async function boundedJson<T>(response: Response): Promise<T> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("GitHub returned an empty recipe response.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_LIBRARY_BYTES)
        throw new Error("Recipe library exceeds the 8 MB loading limit.");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as T;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function readRecipeFiles(
  env: { GITHUB_OWNER: string; GITHUB_REPO: string; GITHUB_BRANCH: string },
  headers: Record<string, string>,
) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        owner: env.GITHUB_OWNER,
        name: env.GITHUB_REPO,
        parent: `${env.GITHUB_BRANCH}:apps/site/src/content`,
        recipes: `${env.GITHUB_BRANCH}:${directory}`,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(`GitHub recipe read failed (${response.status}).`);
  const result = await boundedJson<RecipeLibraryResponse>(response);
  if (result.errors?.length)
    throw new Error(
      "GitHub recipe query failed. Check repository access or retry.",
    );
  const repository = result.data?.repository;
  if (
    repository?.parent?.__typename !== "Tree" ||
    !Array.isArray(repository.parent.entries)
  )
    throw new Error(
      "Could not read the configured recipe repository and branch.",
    );
  const tree = repository.recipes;
  // A new collection has no directory until the first recipe is published.
  // Only an accessible parent that lacks this entry proves the library is empty.
  if (
    tree === null &&
    !repository.parent.entries.some((entry) => entry.name === "recipes")
  )
    return [];
  if (tree?.__typename !== "Tree" || !Array.isArray(tree.entries))
    throw new Error("GitHub returned an incomplete recipe library.");
  return tree.entries
    .filter((entry) => entry.name.endsWith(".md"))
    .map((entry) => {
      const path = `${directory}/${entry.name}`;
      if (!isAllowedRepositoryPath(path) || !/^[a-f0-9]{40}$/i.test(entry.oid))
        throw new Error("Invalid recipe file identity.");
      if (
        entry.type !== "blob" ||
        entry.object?.__typename !== "Blob" ||
        entry.object.isTruncated !== false ||
        typeof entry.object.text !== "string"
      )
        throw new Error("GitHub returned an incomplete recipe file.");
      return { path, sha: entry.oid, text: entry.object.text };
    });
}

interface RecipeRepository {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

export async function readRecipeHead(
  env: RecipeRepository,
  headers: Record<string, string>,
) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query RecipeHead($owner: String!, $name: String!, $branch: String!) {
        repository(owner: $owner, name: $name) {
          ref(qualifiedName: $branch) { target { __typename oid } }
        }
      }`,
      variables: {
        owner: env.GITHUB_OWNER,
        name: env.GITHUB_REPO,
        branch: `refs/heads/${env.GITHUB_BRANCH.replace(/^refs\/heads\//, "")}`,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error(`GitHub recipe branch read failed (${response.status}).`);
  const result = await boundedJson<{
    errors?: unknown[];
    data?: {
      repository?: { ref?: { target?: { __typename: string; oid: string } } };
    };
  }>(response);
  const target = result.data?.repository?.ref?.target;
  if (
    result.errors?.length ||
    target?.__typename !== "Commit" ||
    !/^[a-f0-9]{40}$/i.test(target.oid)
  )
    throw new Error("Could not read the recipe publication branch.");
  return target.oid;
}

export class RecipePublishError extends Error {}

// createCommitOnBranch atomically checks expectedHeadOid and appends a commit.
// Read the library at that immutable head before calling this function. A
// simultaneous publication must cause a conflict, never an implicit retry.
// https://docs.github.com/en/graphql/reference/commits#createcommitonbranch
export async function createRecipeFile(
  env: RecipeRepository,
  headers: Record<string, string>,
  item: { path: string; contents: string; message: string },
  expectedHeadOid: string,
) {
  if (
    !item.path.startsWith(`${directory}/`) ||
    !isAllowedRepositoryPath(item.path) ||
    !/^[a-f0-9]{40}$/i.test(expectedHeadOid)
  )
    throw new Error("Invalid recipe publication destination.");
  const uncertain =
    "Recipe publication could not be confirmed. Reload Recipes and reopen any published version before trying again.";
  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation CreateRecipe($input: CreateCommitOnBranchInput!, $path: String!) {
          createCommitOnBranch(input: $input) {
            commit { oid url file(path: $path) { oid path type } }
          }
        }`,
        variables: {
          path: item.path,
          input: {
            branch: {
              repositoryNameWithOwner: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
              branchName: env.GITHUB_BRANCH.replace(/^refs\/heads\//, ""),
            },
            expectedHeadOid,
            message: { headline: item.message.replace(/[\r\n]/g, " ") },
            fileChanges: {
              additions: [{ path: item.path, contents: item.contents }],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new RecipePublishError(uncertain);
    const result = await boundedJson<{
      errors?: unknown[];
      data?: {
        createCommitOnBranch?: {
          commit?: {
            oid: string;
            url: string;
            file?: { oid: string; path: string; type: string };
          };
        };
      };
    }>(response);
    const commit = result.data?.createCommitOnBranch?.commit;
    if (
      result.errors?.length ||
      !commit ||
      !/^[a-f0-9]{40}$/i.test(commit.oid) ||
      !commit.file ||
      !/^[a-f0-9]{40}$/i.test(commit.file.oid) ||
      commit.file.path !== item.path ||
      commit.file.type !== "blob" ||
      typeof commit.url !== "string"
    )
      throw new RecipePublishError(uncertain);
    return {
      commit: { sha: commit.oid, html_url: commit.url },
      content: { path: item.path, sha: commit.file.oid },
    };
  } catch {
    throw new RecipePublishError(uncertain);
  }
}
