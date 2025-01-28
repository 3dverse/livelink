import fs from "fs/promises";

const BOT_3DVERSE_GITLAB_API_TOKEN = process.env.BOT_3DVERSE_GITLAB_API_TOKEN!;
const CI_API_V4_URL = process.env.CI_API_V4_URL!;
const CI_COMMIT_REF_NAME = process.env.CI_COMMIT_REF_NAME!;
const CI_PROJECT_ID = process.env.CI_PROJECT_ID!;

type MergeRequest = {
    id: number;
    iid: number;
    project_id: number;
    title: string;
    description: string;
    state: string;
    web_url: string;
};

(async () => {
    try {
        // Check that all required environment variables are set
        const requiredKeys = ["BOT_3DVERSE_GITLAB_API_TOKEN", "CI_API_V4_URL", "CI_COMMIT_REF_NAME", "CI_PROJECT_ID"];
        for (const env of requiredKeys) {
            if (!process.env[env]) {
                throw new Error(`missing environment variable: ${env}`);
            }
        }

        const baseURL = `${CI_API_V4_URL}/projects/${CI_PROJECT_ID}`;
        const baseHeaders = {
            Authorization: `Bearer ${BOT_3DVERSE_GITLAB_API_TOKEN}`,
        };
        const mergeRequestName = "chore: new release";
        const mergeRequestDraftName = `Draft: ${mergeRequestName}`;
        const targetBranch = "release";

        // Check if merge request already exists
        const openedMRsRes = await fetch(`${baseURL}/merge_requests?state=opened`, {
            method: "GET",
            headers: baseHeaders,
        });
        const openedMRs = (await openedMRsRes.json()) as MergeRequest[];

        for (const mr of openedMRs) {
            // Exit without error if the merge request already exists
            if (mr.title === mergeRequestName || mr.title === mergeRequestDraftName) {
                console.info(`merge request already exists: ${mr.web_url}`);
                process.exit(0);
            }
        }

        // Create a new merge request using the GitLab API
        const createMRRes = await fetch(`${baseURL}/merge_requests`, {
            method: "POST",
            headers: {
                ...baseHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: CI_PROJECT_ID,
                source_branch: CI_COMMIT_REF_NAME,
                target_branch: targetBranch,
                remove_source_branch: false,
                title: mergeRequestDraftName,
            }),
        });
        if (!createMRRes.ok) {
            throw new Error(`failed to create merge request: ${createMRRes.statusText}`);
        }

        const createdMR = (await createMRRes.json()) as MergeRequest;
        await fs.writeFile("mr-url.txt", createdMR.web_url, "utf8");
        console.info(`created merge request: ${createdMR.web_url}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
