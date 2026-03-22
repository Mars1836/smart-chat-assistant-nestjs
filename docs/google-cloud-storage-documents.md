# Google Cloud Storage for Documents

This project can store knowledge-base documents in Google Cloud Storage instead of local `uploads/`.

## Environment

Set these variables in `.env`:

```env
DOCUMENT_STORAGE_DRIVER=gcs
GCS_BUCKET_NAME=your-bucket-name
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILENAME=E:/path/to/service-account.json
GCS_DOCUMENTS_PREFIX=documents
```

You can use `GCS_CREDENTIALS_JSON` instead of `GCS_KEY_FILENAME` if you want to inject the service-account JSON directly.

## Required Google Cloud setup

1. Create a bucket.
2. Create a service account.
3. Grant the service account access to the bucket.
4. Download the JSON key and point `GCS_KEY_FILENAME` to it.

Minimum suggested role: `Storage Object Admin` on the target bucket.

## Migration

Dry run first:

```bash
npm run migrate:documents:gcs -- --dry-run
```

Run the real migration:

```bash
npm run migrate:documents:gcs
```

Delete old local files after the DB has been updated:

```bash
npm run migrate:documents:gcs -- --delete-local
```

## Behavior

- New documents are uploaded to GCS and stored as `gs://bucket/prefix/workspaceId/file`.
- Existing local documents with `/uploads/...` continue to work until migrated.
- Document viewing still goes through the backend access-token flow; files are not exposed as public GCS URLs by default.
