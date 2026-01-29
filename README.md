<p align="center">
  <img src="asset/banner.png" alt="air-pen" width="100%">
</p>


# ✋🖋️ Air-Kalam

**Gesture-Controlled Virtual Whiteboard using Computer Vision**

---

## 🚀 Project Overview

**Air-Kalam** is a real-time, gesture-driven virtual whiteboard that allows users to draw in the air using only hand movements captured via a webcam.  
No mouse. No touch. Just **Computer Vision + Human-Computer Interaction**.

This project showcases strong fundamentals in:
- Real-time computer vision
- Gesture recognition
- UI engineering
- System-level thinking

---

## 🧠 Key Highlights

- Real-time hand landmark detection using **MediaPipe**
- Smooth, anti-aliased air drawing
- Gesture-based mode switching
- Modern CustomTkinter GUI
- Resolution-independent internal canvas
- Dark / Light mode support

---

## 🖐️ Gesture Controls

| Gesture | Action |
|-------|-------|
| ☝️ Index finger up | Draw |
| ✌️ Index + Middle finger | Pause drawing |
| ✋ All fingers open | Clear canvas |
| 🤙 Pinky finger only | Eraser mode |

---

## 🎨 Features

- ✋ Touch-free air drawing
- 🎨 Multiple pen colors
- 🖌️ Adjustable brush size
- 🧽 Gesture-based eraser
- 💾 Save drawings as PNG
- 🌗 Dark / Light mode toggle
- 📷 Live camera preview
- ⚡ Optimized real-time performance

---

## 🏗️ System Architecture

```
Webcam Feed
     ↓
MediaPipe Hand Tracking
     ↓
Landmark Processing
     ↓
Gesture Classification
     ↓
Drawing Logic (OpenCV)
     ↓
Internal Canvas
     ↓
CustomTkinter GUI
```

---

## 🛠️ Tech Stack

**Core**
- Python
- OpenCV
- MediaPipe
- NumPy

**UI**
- CustomTkinter
- Pillow (PIL)

---

## 📂 Project Structure

```
Air-Kalam/
│
├── draw.py
├── requirements.txt
├── README.md
└── .gitignore
```

---

## ⚙️ Installation & Setup

### Clone Repository
```bash
git clone https://github.com/ArnavPundir22/Air-Kalam-.git
cd Air-Kalam-
```

### Create Virtual Environment (Recommended)
```bash
python3 -m venv venv
source venv/bin/activate
```

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run Application
```bash
python draw.py
```

---

## 💾 Saving Drawings

Drawings are saved as:
```
drawing_<timestamp>.png
```

---

## 🎯 Use Cases

- Smart classrooms
- Virtual whiteboards
- Touch-free interfaces
- Computer vision portfolios
- HCI research

---

## 🔮 Future Enhancements

- Multi-hand support
- Undo / Redo
- Shape recognition
- PDF export
- AI handwriting recognition

---

## 👨‍💻 Author

**Arnav Pundir**  
GitHub: https://github.com/ArnavPundir22

---

⭐ If you like this project, give it a star!
