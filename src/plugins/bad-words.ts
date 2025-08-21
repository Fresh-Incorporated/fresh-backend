import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";

// экранирование спецсимволов в исходных словах
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// омографы (латиница ↔ кириллица) + вариантные буквы
const EQUIV: Record<string, string> = {
    // кириллица с латинскими двойниками
    "а": "аa", "е": "еeё", "о": "оo", "р": "рp", "с": "сc",
    "х": "хx", "у": "уy", "к": "кk", "м": "мm", "т": "тt",
    "в": "вb", "н": "нh",
    // вариантные
    "ё": "еёe",
    "и": "ий", "й": "ий",
};

// из символа делаем класс с эквивалентами: [еeё] и т.п.
function toCharClass(ch: string): string {
    const lower = ch.toLowerCase();
    const pool = EQUIV[lower];
    if (pool) {
        // убираем дубликаты в классе
        const uniq = Array.from(new Set(pool.split("")));
        return `[${uniq.join("")}]`;
    }
    return escapeRegex(ch);
}

// строим «эластичную» маску для слова:
// каждая буква -> (класс)+, т.е. допускаем растяжение: н+е+г+р+
function makeElasticPattern(word: string): string {
    const letters = Array.from(word.normalize("NFC"));
    const parts: string[] = [];

    for (const ch of letters) {
        // пропускаем пробелы и запятые внутри словаря (иногда встречаются)
        if (/\s|,/.test(ch)) continue;
        parts.push(`${toCharClass(ch)}+`);
    }

    // можно включить «микро-разделители» между буквами (пробел/точка/дефис) — по желанию:
    // const SEP = "[\\p{Z}_\\-\\.·•]{0,2}";
    // return parts.join(SEP);

    return parts.join("");
}

// фильтруем слова: берём только те, где есть кириллица
const CYRILLIC_RE = /[\p{Script=Cyrillic}]/u;

export default fp(async function (fastify: FastifyInstance) {
    const jsonPath = path.resolve(process.cwd(), "./banWords.json");
    const raw = fs.readFileSync(jsonPath, "utf8");
    const wordsAll: unknown = JSON.parse(raw)?.words;

    const ruWords = Array.isArray(wordsAll)
        ? (wordsAll as string[])
            .filter(w => typeof w === "string" && CYRILLIC_RE.test(w))
            .map(w => w.trim())
            .filter(Boolean)
        : [];

    // собираем единый RegExp c границами по «не-буква/буква»
    // (?<!\p{L})  — слева не-буква;  (?!\p{L}) — справа не-буква.
    const pattern = `(?<!\\p{L})(?:${ruWords
        .map(w => makeElasticPattern(w))
        .join("|")})(?!\\p{L})`;

    const regex = new RegExp(pattern, "giu");

    function clean(text: string): string {
        return text.replace(regex, (m) => "*".repeat(Array.from(m).length));
    }

    function test(text: string): boolean {
        regex.lastIndex = 0; // на всякий случай сбрасываем индекс
        return regex.test(text);
    }

    fastify.decorate("badWords", {
        clean,
        test,
        regex,
        words: ruWords,
    });
});

// —— Type augmentation ——
declare module "fastify" {
    interface FastifyInstance {
        badWords: {
            clean: (text: string) => string;
            test: (text: string) => boolean;
            regex: RegExp;
            words: string[];
        };
    }
}