# Be Going To — English Grammar Game 🇬🇧

An interactive real-time game for teaching "Be Going To" in English class.

## Features
- 👩‍🏫 **Teacher role**: Create session, configure questions, monitor students live
- 🧑‍🎓 **Student role**: Join with class code, play in real-time
- 5 question types: Auxiliary verb, Fill in blank, Grammar structure, Negative form, Vocabulary
- Timer per question with speed bonus points
- Live leaderboard
- Export results to Excel / TXT

## Deploy on Render

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Deploy!

## Local Usage

```bash
npm install
npm start
# Open http://localhost:3000
```

## How to Play

1. Teacher goes to `/docente`, creates a session → gets a 4-digit code
2. Students go to `/alumno`, enter the code + their info
3. Teacher clicks "Start Game!"
4. Students answer questions in real-time
5. Teacher monitors the live leaderboard
