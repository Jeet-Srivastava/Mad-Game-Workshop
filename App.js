import { Accelerometer } from "expo-sensors";
import { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Text, Pressable, TouchableOpacity, ImageBackground } from "react-native";
import { Audio } from "expo-av";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const PLAYER_WIDTH = 50;
const PLAYER_HEIGHT = 50;
const BULLET_WIDTH = 10;
const BULLET_HEIGHT = 20;
const ENEMY_WIDTH = 40;
const ENEMY_HEIGHT = 40;

const isColliding = (rect1, rect2) => {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.y + rect1.h > rect2.y
  );
};

export default function App() {
  const [gameId, setGameId] = useState(0);

  return (
    <ImageBackground 
      source={require('./assets/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <GameEngine 
        key={gameId} 
        onRestart={() => setGameId(gameId + 1)} 
        autoStart={gameId > 0} 
      />
    </ImageBackground>
  );
}

function GameEngine({ onRestart, autoStart }) {
  const [tick, setTick] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(autoStart);

  const gameState = useRef({
    playerX: (screenWidth - PLAYER_WIDTH) / 2,
    bullets: [],
    enemies: [],
    score: 0,
    tilt: 0,
    isRunning: true,
    isGameStarted: autoStart,
  });

  const playSound = async (type) => {
    try {
      const soundMap = {
        shoot: require('./assets/shoot.mp3'), 
        fail: require('./assets/gameover.mp3'), 
      };
      
      // return; 

      const { sound } = await Audio.Sound.createAsync(soundMap[type]);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) await sound.unloadAsync();
      });
    } catch (error) {
    }
  };

  useEffect(() => {
    Accelerometer.setUpdateInterval(16);
    const subscription = Accelerometer.addListener(({ x }) => {
      gameState.current.tilt = x;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let animationFrameId;

    const loop = () => {
      if (!gameState.current.isGameStarted) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      if (!gameState.current.isRunning) return;

      const state = gameState.current;

      const move = -state.tilt * 20;
      state.playerX = Math.max(0, Math.min(state.playerX + move, screenWidth - PLAYER_WIDTH));

      state.bullets = state.bullets
        .map((b) => ({ ...b, y: b.y - 15 }))
        .filter((b) => b.y > -BULLET_HEIGHT);

      state.enemies = state.enemies.map((e) => ({ ...e, y: e.y + 5 }));

      if (state.enemies.some((e) => e.y > screenHeight)) {
        gameOver(); return;
      }

      if (Math.random() < 0.02) {
        state.enemies.push({
          x: Math.random() * (screenWidth - ENEMY_WIDTH),
          y: -ENEMY_HEIGHT,
          id: Math.random().toString(),
        });
      }

      const activeBullets = [];
      const activeEnemies = [...state.enemies];
      
      const playerHit = activeEnemies.some(e => 
        isColliding(
          { x: e.x, y: e.y, w: ENEMY_WIDTH, h: ENEMY_HEIGHT },
          { x: state.playerX, y: screenHeight - PLAYER_HEIGHT - 20, w: PLAYER_WIDTH, h: PLAYER_HEIGHT }
        )
      );

      if (playerHit) { gameOver(); return; }

      state.bullets.forEach((b) => {
        let hit = false;
        for (let i = 0; i < activeEnemies.length; i++) {
          if (isColliding({ x: b.x, y: b.y, w: BULLET_WIDTH, h: BULLET_HEIGHT }, { x: activeEnemies[i].x, y: activeEnemies[i].y, w: ENEMY_WIDTH, h: ENEMY_HEIGHT })) {
            state.score += 10;
            hit = true;
            activeEnemies.splice(i, 1);
            break;
          }
        }
        if (!hit) activeBullets.push(b);
      });

      state.bullets = activeBullets;
      state.enemies = activeEnemies;

      setTick((t) => t + 1);
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const gameOver = () => {
    gameState.current.isRunning = false;
    setIsGameOver(true);
    playSound('fail');
  };

  const startGame = () => {
    gameState.current.isGameStarted = true;
    setIsGameStarted(true);
  };

  const fireBullet = () => {
    if (!isGameStarted || isGameOver) return;
    playSound('shoot');
    gameState.current.bullets.push({
      x: gameState.current.playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
      y: screenHeight - PLAYER_HEIGHT - 40,
      id: Math.random().toString(),
    });
  };

  const { playerX, bullets, enemies, score } = gameState.current;

  return (
    <Pressable style={styles.container} onPress={fireBullet}>
      
      {isGameStarted && (
        <>
          <Text style={styles.score}>Score: {score}</Text>
          <View style={[styles.player, { left: playerX }]} />
          {bullets.map((b) => (
            <View key={b.id} style={[styles.bullet, { left: b.x, top: b.y }]} />
          ))}
          {enemies.map((e) => (
            <View key={e.id} style={[styles.enemy, { left: e.x, top: e.y }]} />
          ))}
        </>
      )}

      {!isGameStarted && (
        <View style={styles.startScreenOverlay}>
          <Text style={styles.gameTitle}>SPACE SHOOTER</Text>
          <Text style={styles.instructions}>Tilt to Move • Tap to Shoot</Text>
          <TouchableOpacity onPress={startGame} style={styles.startButton}>
            <Text style={styles.startButtonText}>START GAME</Text>
          </TouchableOpacity>
        </View>
      )}

      {isGameOver && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          <Text style={styles.finalScore}>Final Score: {score}</Text>
          <TouchableOpacity onPress={onRestart} style={styles.restartButton}>
            <Text style={styles.restartText}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  score: { position: "absolute", top: 60, left: 20, color: "white", fontSize: 24, fontWeight: "bold", zIndex: 10 },
  player: { position: "absolute", bottom: 20, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, backgroundColor: "cyan" },
  bullet: { position: "absolute", width: BULLET_WIDTH, height: BULLET_HEIGHT, backgroundColor: "white", borderRadius: 5 },
  enemy: { position: "absolute", width: ENEMY_WIDTH, height: ENEMY_HEIGHT, backgroundColor: "red" },
  
  gameOverOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)', 
    justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  gameOverText: { color: '#222', fontSize: 40, fontWeight: 'bold', marginBottom: 10 },
  finalScore: { color: '#444', fontSize: 24, marginBottom: 30 },
  restartButton: { backgroundColor: '#000', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10 },
  restartText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  startScreenOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  gameTitle: { fontSize: 42, fontWeight: '900', color: 'white', marginBottom: 10, letterSpacing: 2 },
  instructions: { fontSize: 16, color: '#ddd', marginBottom: 40 },
  startButton: { backgroundColor: 'cyan', paddingHorizontal: 40, paddingVertical: 20, borderRadius: 50, borderWidth: 2, borderColor: 'white' },
  startButtonText: { color: 'black', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
});
