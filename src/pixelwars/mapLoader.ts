import { Jimp, intToRGBA } from "jimp";
import { PWPixel } from "../models/PWPixel";
import path from "path";

export async function loadMap(): Promise<void> {
    const filePath = path.resolve(__dirname, "../../pixelwars-map.png");
    const image = await Jimp.read(filePath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    const pixels: { x: number; y: number; type: "border" | "state" }[] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const color = image.getPixelColor(x, y); // число ARGB
            const { r, g, b } = intToRGBA(color);   // intToRGBA теперь тоже нужно импортировать

            // Красный = море → пропускаем
            if (r === 255 && g === 0 && b === 0) continue;

            // Чёрный = границы
            if (r === 0 && g === 0 && b === 0) {
                pixels.push({ x, y, type: "border" });
                continue;
            }

            // Белый = земля
            if (r === 255 && g === 255 && b === 255) {
                pixels.push({ x, y, type: "state" });
                continue;
            }
        }
    }

    await PWPixel.sync({ force: true });
    console.log("Loading map to database..")
    await PWPixel.bulkCreate(pixels as PWPixel[]);
    console.log("Map loaded to database!")
}
