import { Hono } from "hono";
import { readdir } from "fs/promises";
import { swaggerUI } from "@hono/swagger-ui";
import sharp from "sharp";
import { readFileSync } from "fs";
import { parse } from "yaml";
import {
  createAlarm,
  getAllAlarms,
  getAlarmById,
  updateAlarm,
  deleteAlarm,
  toggleAlarmStatus,
  getActiveAlarmsForTime,
} from "./db";

interface SoundMetadata {
  description: string;
  tags: string[];
  author: string;
  lastUpdated: string;
  details: string;
  publishDate: string;
}

interface Sound {
  id: number;
  name: string;
  metadata: SoundMetadata;
  audio: {
    url: string;
    format: string;
    duration?: number;
  };
  cover: {
    url: string;
    format: string;
    dimensions?: {
      width: number;
      height: number;
    };
  };
  statistics: {
    plays: number;
    favorites: number;
    downloads: number;
  };
  relatedSounds?: number[];
}

const app = new Hono();

export const VALID_API_KEYS = [
  "scplay-secret-key",
  "kitty-secret-key",
  "sofia-secret-key",
  "liu-secret-key",
  "external-secret-key",
];

app.use("*", async (c, next) => {
  const publicPath = [
    "/validate-key",
    "/ui",
    "/doc",
    "/swagger-config",
    "/cover",
    "/audio",
  ];
  publicPath.forEach((path) => {
  for (const path of publicPath) {
    if (c.req.path.startsWith(path)) {
      await next();
      return;
    }
  })
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey || !VALID_API_KEYS.includes(apiKey)) {
    return c.json({ error: "Unauthorized: Invalid or missing API key" }, 401);
  }
  await next();
});

async function generateApi(): Promise<Sound[]> {
  const sounds: Sound[] = [];
  const dirPath = "./assets/music";
  try {
    const files = await readdir(dirPath);
    for (const fileName of files) {
      if (fileName.endsWith(".mp3")) {
        const title = fileName
          .replace(".mp3", "")
          .replace("_", " ")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        const descriptionFile = Bun.file(
          `./assets/description/${fileName.replace(".mp3", ".txt")}`,
        );
        const descriptionContent = await descriptionFile.text();
        const lines = descriptionContent.split("\n");
        const metadata: SoundMetadata = {
          description: lines[0].replace("description: ", ""),
          tags: lines[1].replace("tag: ", "").split("-"),
          author: lines[2].replace("author: ", ""),
          lastUpdated: lines[3].replace("last_updated: ", ""),
          details: lines[4].replace("details: ", ""),
          publishDate: lines[5].replace("publish_date: ", ""),
        };
        const coverPath = `./assets/cover/${fileName.replace(".mp3", ".jpg")}`;
        const coverImage = sharp(coverPath);
        const coverMetadata = await coverImage.metadata();
        const statistics = {
          plays: Math.floor(Math.random() * 10000),
          favorites: Math.floor(Math.random() * 1000),
          downloads: Math.floor(Math.random() * 5000),
        };
        const relatedSounds = Array.from(
          { length: Math.floor(Math.random() * 3) + 1 },
          () => Math.floor(Math.random() * files.length) + 1,
        ).filter((id) => id !== sounds.length + 1);
        sounds.push({
          id: sounds.length + 1,
          name: title,
          metadata,
          audio: {
            url: `/audio/${fileName}`,
            format: "mp3",
            duration: Math.floor(Math.random() * 300) + 60,
          },
          cover: {
            url: `/cover/${fileName.replace(".mp3", ".jpg")}`,
            format: "jpg",
            dimensions: {
              width: coverMetadata.width || 0,
              height: coverMetadata.height || 0,
            },
          },
          statistics,
          relatedSounds,
        });
      }
    }
    return sounds;
  } catch (error) {
    console.log(error);
    return [];
  }
}

app.get("/sounds", async (c) => {
  const sounds = await generateApi();
  const search = c.req.header("search");
  const sort = c.req.header("sort");
  const filter = c.req.header("filter");
  let filteredSounds = sounds;
  if (search) {
    filteredSounds = filteredSounds.filter(
      (sound) =>
        sound.name.toLowerCase().includes(search.toLowerCase()) ||
        sound.metadata.tags.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase()),
        ) ||
        sound.metadata.author.toLowerCase().includes(search.toLowerCase()),
    );
  }
  if (filter) {
    switch (filter.toLowerCase()) {
      case "author":
        const author = c.req.header("author");
        if (author) {
          filteredSounds = filteredSounds.filter(
            (sound) =>
              sound.metadata.author.toLowerCase() === author.toLowerCase(),
          );
        }
        break;
      case "tag":
        const tag = c.req.header("tag");
        if (tag) {
          filteredSounds = filteredSounds.filter((sound) =>
            sound.metadata.tags.some(
              (t) => t.toLowerCase() === tag.toLowerCase(),
            ),
          );
        }
        break;
      case "date":
        const startDate = c.req.header("startDate");
        const endDate = c.req.header("endDate");
        if (startDate || endDate) {
          filteredSounds = filteredSounds.filter((sound) => {
            const publishDate = new Date(sound.metadata.publishDate);
            if (startDate && endDate) {
              return (
                publishDate >= new Date(startDate) &&
                publishDate <= new Date(endDate)
              );
            } else if (startDate) {
              return publishDate >= new Date(startDate);
            } else if (endDate) {
              return publishDate <= new Date(endDate);
            }
            return true;
          });
        }
        break;
    }
  }
  if (sort) {
    filteredSounds.sort((a, b) => {
      const dateA = new Date(a.metadata.publishDate);
      const dateB = new Date(b.metadata.publishDate);
      return sort.toLowerCase() === "asc"
        ? dateA.getTime() - dateB.getTime()
        : dateB.getTime() - dateA.getTime();
    });
  }
  return c.json(
    filteredSounds.length > 0 ? filteredSounds : { error: "No sounds found" },
    filteredSounds.length > 0 ? 200 : 404,
  );
});

app.get("/audio/:fileName", async (c) => {
  const fileName = c.req.param("fileName");
  const filePath = `./assets/music/${fileName}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return c.body(file.stream(), {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  }
  return c.json({ error: "Audio file not found" }, 404);
});

app.get("/cover/:fileName", async (c) => {
  const fileName = c.req.param("fileName");
  const filePath = `./assets/cover/${fileName}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return c.body(file.stream(), {
      headers: {
        "Content-Type": "image/jpeg",
      },
    });
  }
  return c.json({ error: "Cover image not found" }, 404);
});

app.get(
  "/ui",
  swaggerUI({
    url: "/doc",
    configUrl: "/swagger-config",
  }),
);

app.get("/swagger-config", (c) => {
  return c.json({
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: "list",
    filter: true,
    tryItOutEnabled: true,
  });
});

app.get("/doc", (c) => {
  const swaggerYaml = readFileSync("./swagger.yaml", "utf8");
  const openApiSpec = parse(swaggerYaml);
  return c.json(openApiSpec);
});

app.post("/alarms", async (c) => {
  try {
    const apiKey = c.req.header("X-API-Key")!;
    const { soundId, soundName, alarmTime } = await c.req.json();
    const alarm = createAlarm(apiKey, soundId, soundName, alarmTime);
    return c.json(alarm, 201);
  } catch (error) {
    return c.json({ error: "Failed to create alarm" }, 400);
  }
});

app.get("/alarms", (c) => {
  const apiKey = c.req.header("X-API-Key")!;
  const alarms = getAllAlarms(apiKey);
  return c.json(alarms);
});

app.get("/alarms/:id", (c) => {
  const apiKey = c.req.header("X-API-Key")!;
  const id = parseInt(c.req.param("id"));
  try {
    const alarm = getAlarmById(apiKey, id);
    return c.json(alarm);
  } catch (error) {
    return c.json({ error: "Alarm not found" }, 404);
  }
});

app.put("/alarms/:id", async (c) => {
  const apiKey = c.req.header("X-API-Key")!;
  const id = parseInt(c.req.param("id"));
  try {
    const updates = await c.req.json();
    const alarm = updateAlarm(apiKey, id, updates);
    return c.json(alarm);
  } catch (error) {
    return c.json({ error: "Failed to update alarm" }, 400);
  }
});

app.delete("/alarms/:id", (c) => {
  const apiKey = c.req.header("X-API-Key")!;
  const id = parseInt(c.req.param("id"));
  try {
    deleteAlarm(apiKey, id);
    return c.json({ message: "Alarm deleted successfully" });
  } catch (error) {
    return c.json({ error: "Failed to delete alarm" }, 400);
  }
});

app.patch("/alarms/:id/toggle", (c) => {
  const apiKey = c.req.header("X-API-Key")!;
  const id = parseInt(c.req.param("id"));
  try {
    const alarm = toggleAlarmStatus(apiKey, id);
    return c.json(alarm);
  } catch (error) {
    return c.json({ error: "Failed to toggle alarm status" }, 400);
  }
});

app.get("/alarms/active/:time", (c) => {
  const apiKey = c.req.header("X-API-Key")!;
  const time = c.req.param("time");
  const alarms = getActiveAlarmsForTime(apiKey, time);
  return c.json(alarms);
});

app.get("/validate-key", (c) => {
  const apiKey = c.req.header("X-API-Key");
  if (!apiKey) {
    return c.json({ valid: false, message: "No API key provided" }, 401);
  }
  const isValid = VALID_API_KEYS.includes(apiKey);
  if (!isValid) {
    return c.json({ valid: false, message: "Invalid API key" }, 401);
  }
  return c.json({ valid: true, message: "API key is valid" });
});

Bun.serve({
  fetch: app.fetch,
  port: process.env.PORT || 3000,
});

console.log(`Skills Music API V3 running on port ${process.env.PORT || 3000}`);
console.log(
  `Swagger UI available at http://localhost:${process.env.PORT || 3000}/ui`,
);
