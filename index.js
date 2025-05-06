const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Подключение к MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Модель пользователя
const userSchema = new mongoose.Schema({
  login: { type: String, unique: true },
  hwid: String,
  timeLeft: Number,
});
const User = mongoose.model("User", userSchema);

// Авторизация
app.post("/authorize", async (req, res) => {
  const { login, hwid } = req.body;
  if (!login || !hwid)
    return res
      .status(400)
      .json({ status: "error", message: "login и hwid обязательны" });

  let user = await User.findOne({ login });

  if (user) {
    if (user.hwid !== hwid) {
      return res.status(400).json({
        status: "error",
        message: "Этот логин привязан к другому железу.",
      });
    }
    return res.json({ status: "ok", timeLeft: user.timeLeft });
  }

  // Проверка — нет ли уже такого hwid
  const hwidExists = await User.findOne({ hwid });
  if (hwidExists) {
    return res.status(400).json({
      status: "error",
      message: "Этот HWID уже привязан к другому аккаунту.",
    });
  }

  user = new User({ login, hwid, timeLeft: 60 });
  await user.save();
  return res.json({ status: "ok", timeLeft: 60 });
});

// Выход
app.post("/logout", async (req, res) => {
  const { login } = req.body;
  if (!login)
    return res
      .status(400)
      .json({ status: "error", message: "login обязателен" });

  const result = await User.deleteOne({ login });
  if (result.deletedCount === 0) {
    return res
      .status(404)
      .json({ status: "error", message: "Пользователь не найден" });
  }

  return res.json({ status: "ok", message: "Выход выполнен" });
});

// Списать время
app.post("/consume", async (req, res) => {
  const { login, minutes, hwid } = req.body;
  if (!login || typeof minutes !== "number" || !hwid)
    return res
      .status(400)
      .json({ status: "error", message: "login, minutes и hwid обязательны" });

  const user = await User.findOne({ login });
  if (!user)
    return res
      .status(404)
      .json({ status: "error", message: "Пользователь не найден" });
  if (user.hwid !== hwid)
    return res
      .status(403)
      .json({ status: "error", message: "HWID не совпадает" });
  if (user.timeLeft < minutes)
    return res
      .status(400)
      .json({ status: "error", message: "Недостаточно времени" });

  user.timeLeft -= minutes;
  await user.save();
  return res.json({ status: "ok", timeLeft: user.timeLeft });
});

// Установить время вручную
app.post("/set-time", async (req, res) => {
  const { login, minutes, hwid } = req.body;
  if (!login || typeof minutes !== "number" || !hwid)
    return res
      .status(400)
      .json({ status: "error", message: "login, minutes и hwid обязательны" });

  const user = await User.findOne({ login });
  if (!user)
    return res
      .status(404)
      .json({ status: "error", message: "Пользователь не найден" });
  if (user.hwid !== hwid)
    return res
      .status(403)
      .json({ status: "error", message: "HWID не совпадает" });

  user.timeLeft = minutes;
  await user.save();
  return res.json({ status: "ok", login, timeLeft: minutes });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
