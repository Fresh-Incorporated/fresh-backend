from PIL import Image

# Открываем исходное изображение
img = Image.open("map.png").convert("RGB")
pixels = img.load()

# Проходим по каждому пикселю
for y in range(img.height):
    for x in range(img.width):
        r, g, b = pixels[x, y]
        # Проверяем, является ли пиксель чисто белым, черным или красным
        if (r, g, b) not in [(255, 255, 255), (0, 0, 0), (255, 0, 0)]:
            pixels[x, y] = (0, 0, 0)  # Заменяем на черный

# Сохраняем результат
img.save("pixelwars-map.png")
print("Готово! Новый файл сохранён как pixelwars-map.png")
