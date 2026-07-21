---
title: Yewogen Derash Face Service
emoji: 🛡️
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Yewogen Derash — Face Recognition Service

Corporate-grade face recognition using **InsightFace `buffalo_l`**
(**RetinaFace** detection + **ArcFace** 512-D embeddings), matched by cosine
similarity. Used by the platform as the **authoritative KYC same-person check**:
the fundraiser's live biometric selfie is compared 1:1 against the photo on
their ID.

The web app only needs the **stateless `/compare`** endpoint, so this can be a
fresh deployment or a shared one — no per-app member store.

## Endpoints (used by the app)

| Method | Path       | Body                              | Returns |
|--------|------------|-----------------------------------|---------|
| GET    | `/health`  | —                                 | status + threshold |
| POST   | `/compare` | `{ image_a, image_b, api_key? }`  | `{ ok, similarity, same_person }` |

`image_*` is a data-URL or raw base64 JPEG/PNG. When `FACE_API_KEY` is set,
every request body must include a matching `api_key`.

## Environment variables

| Var | Default | Meaning |
|-----|---------|---------|
| `FACE_THRESHOLD` | `0.36` | cosine similarity required for a match |
| `FACE_API_KEY` | (none) | shared secret; if set, callers must send `api_key` |
| `PORT` | `7860` | listen port |

## Deploy free on Hugging Face Spaces

1. Create a new Space → **SDK: Docker**.
2. Upload this folder (`app.py`, `requirements.txt`, `Dockerfile`, this README).
3. (Optional) Space → Settings → **Variables**: set `FACE_API_KEY`.
4. The service is live at `https://<user>-<space>.hf.space`.

## Point the app at it

In the web app's environment (Vercel / `.env`):

```
FACE_SERVICE_URL=https://<user>-<space>.hf.space
FACE_API_KEY=<same secret as the Space, if you set one>
```

With `FACE_SERVICE_URL` set, `lib/face/service.ts` sends the live selfie + ID
photo to `/compare` and stores the verdict (`faceMatched` + cosine similarity +
`faceEngine = "insightface"`) on the owner, shown to the KYC reviewer. If the
variable is unset, the app falls back to the in-browser `@vladmandic/face-api`
engine automatically.
