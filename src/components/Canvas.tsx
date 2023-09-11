import { useEffect, useState } from "react";

function Canvas() {
  const [goldCoinSprites, setGoldCoinSprites] = useState<HTMLImageElement[]>(
    []
  );
  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const spriteImageUrls = [
      "/sprites/goldCoins/Gold_21.png",
      "/sprites/goldCoins/Gold_22.png",
      "/sprites/goldCoins/Gold_23.png",
      "/sprites/goldCoins/Gold_24.png",
      "/sprites/goldCoins/Gold_25.png",
      "/sprites/goldCoins/Gold_26.png",
      "/sprites/goldCoins/Gold_27.png",
      "/sprites/goldCoins/Gold_28.png",
      "/sprites/goldCoins/Gold_29.png",
      "/sprites/goldCoins/Gold_30.png",
    ];

    const loadImages = async () => {
      const loadImage = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.src = url;
          image.onload = () => resolve(image);
          image.onerror = (error) => reject(error);
        });

      try {
        const coinImages = await Promise.all(
          spriteImageUrls.map((url) => loadImage(url))
        );
        setGoldCoinSprites(coinImages);

        const background = await loadImage("/backgrounds/Ocean_4/5.png");
        setBackgroundImage(background);
      } catch (error) {
        console.error("Error loading images", error);
      }
    };

    loadImages();
  }, []);

  useEffect(() => {
    if (goldCoinSprites.length > 0 && backgroundImage) {
      const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
      if (!canvas) {
        return;
      }

      canvas.width = 800; // Adjust as needed
      canvas.height = 500; // Adjust as needed

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const frameRate = 10;
      let frameIndex = 0;

      const animateCoin = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);

        context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        const coinImage = goldCoinSprites[frameIndex];
        if (coinImage) {
          const coinHeight = 50; // Desired height of the coin
          const aspectRatio = coinImage.width / coinImage.height;
          const coinWidth = coinHeight * aspectRatio;

          // Set drop shadow properties
          context.shadowColor = "rgba(0, 0, 0, 0.7)"; // Shadow color
          context.shadowBlur = 10; // Blur radius
          context.shadowOffsetX = 0; // Shadow X offset
          context.shadowOffsetY = 5; // Shadow Y offset

          context.drawImage(
            coinImage,
            400 - coinWidth / 2,
            440,
            coinWidth,
            coinHeight
          );

          // Reset drop shadow properties
          context.shadowColor = "transparent";
          context.shadowBlur = 0;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;
        }

        if (frameIndex < goldCoinSprites.length - 1) {
          frameIndex++;
        } else {
          frameIndex = 0;
        }

        setTimeout(animateCoin, 1000 / frameRate);
      };

      animateCoin();
    }
  }, [goldCoinSprites, backgroundImage]);

  return (
    <div>
      <canvas id="gameCanvas"></canvas>
    </div>
  );
}

export default Canvas;
