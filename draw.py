import cv2
import numpy as np
import mediapipe as mp
import customtkinter as ctk
from PIL import Image, ImageTk
import time

# ---------------- Mediapipe Setup ----------------
mp_hands = mp.solutions.hands
mp_draw = mp.solutions.drawing_utils
hands = mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Camera setup
cap = cv2.VideoCapture(0)

# Internal whiteboard (draw here). Use a larger internal canvas so resizing looks good.
canvas_w, canvas_h = 1280, 720
internal_canvas = 255 * np.ones((canvas_h, canvas_w, 3), dtype=np.uint8)

# Previous point (in internal canvas coords)
prev_x, prev_y = 0, 0
drawing = False

# Default pen settings (B, G, R)
pen_color = (255, 0, 0)  # Blue
brush_size = 7

# Finger landmark indices
TIP_IDS = [4, 8, 12, 16, 20]
PIP_IDS = [3, 6, 10, 14, 18]

# Camera preview size for control panel
CAM_PREVIEW_W, CAM_PREVIEW_H = 200, 150

# ---------------- Helper Functions ----------------
def fingers_up(lm_list):
    """Return finger states (1 if up else 0) given landmark list in (x,y) pairs (camera coords)."""
    fingers = []
    # thumb: compare x positions (since we flip horizontally)
    fingers.append(1 if lm_list[TIP_IDS[0]][0] > lm_list[PIP_IDS[0]][0] else 0)
    # other fingers: tip y < pip y => finger up
    for tip, pip in zip(TIP_IDS[1:], PIP_IDS[1:]):
        fingers.append(1 if lm_list[tip][1] < lm_list[pip][1] else 0)
    return fingers

def safe_size(val, fallback):
    """Return val if > 1 else fallback (prevents zero or 1 px sizes before widget realized)."""
    try:
        if int(val) > 1:
            return int(val)
    except Exception:
        pass
    return fallback

def update_frame():
    global prev_x, prev_y, drawing, pen_color, brush_size, internal_canvas

    ret, frame = cap.read()
    if not ret:
        # camera failed; keep trying
        video_label.after(200, update_frame)
        return

    frame = cv2.flip(frame, 1)  # mirror
    cam_h, cam_w = frame.shape[:2]

    # mediapipe expects RGB
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    cursor_board = None  # fingertip in internal canvas coords

    if result.multi_hand_landmarks:
        # Only use first hand
        handLms = result.multi_hand_landmarks[0]
        lm_list_cam = [(int(lm.x * cam_w), int(lm.y * cam_h)) for lm in handLms.landmark]
        fingers = fingers_up(lm_list_cam)

        # camera fingertip coords
        cam_x, cam_y = lm_list_cam[8]

        # Map camera coords to internal_board coords
        board_x = int(cam_x * (canvas_w / cam_w))
        board_y = int(cam_y * (canvas_h / cam_h))
        cursor_board = (board_x, board_y)

        # Gesture Modes (camera-based finger state)
        if fingers == [0, 1, 0, 0, 0]:      # Only index → draw
            drawing = True
        elif fingers == [0, 1, 1, 0, 0]:    # Index+middle → pause
            drawing = False
            prev_x, prev_y = 0, 0
        elif fingers == [1, 1, 1, 1, 1]:    # All open → clear
            internal_canvas[:] = 255
            prev_x, prev_y = 0, 0
            status_label.configure(text="Canvas cleared")
        elif fingers == [0, 0, 0, 0, 1]:    # Pinky only → eraser
            pen_color = (255, 255, 255)
            status_label.configure(text="Eraser Mode")

        # Drawing on *internal* canvas using board coords
        if drawing and cursor_board is not None:
            bx, by = cursor_board
            if prev_x == 0 and prev_y == 0:
                prev_x, prev_y = bx, by
            # draw a smooth line on internal_canvas
            cv2.line(internal_canvas, (prev_x, prev_y), (bx, by), pen_color, brush_size, lineType=cv2.LINE_AA)
            prev_x, prev_y = bx, by
    else:
        # no hand detected: reset prev so next stroke starts fresh
        prev_x, prev_y = 0, 0

    # Prepare image for display: resize internal_canvas to the label's size
    label_w = safe_size(video_label.winfo_width(), 800)
    label_h = safe_size(video_label.winfo_height(), 450)

    # maintain aspect ratio of internal canvas: fit into label
    # compute scaling factors
    scale_w = label_w / canvas_w
    scale_h = label_h / canvas_h
    scale = min(scale_w, scale_h)
    disp_w = max(1, int(canvas_w * scale))
    disp_h = max(1, int(canvas_h * scale))

    display_img = cv2.resize(internal_canvas, (disp_w, disp_h), interpolation=cv2.INTER_LINEAR)

    # If cursor exists, draw it on the display image at scaled position
    if cursor_board is not None:
        cx = int(cursor_board[0] * (disp_w / canvas_w))
        cy = int(cursor_board[1] * (disp_h / canvas_h))
        # outer circle (semi-transparent look is tricky with cv2+tk; simple solid)
        cv2.circle(display_img, (cx, cy), max(6, brush_size), (0, 0, 0), -1, lineType=cv2.LINE_AA)  # outer black
        cv2.circle(display_img, (cx, cy), max(3, brush_size//2), (0, 255, 0), -1, lineType=cv2.LINE_AA)  # inner green

    # Convert BGR -> RGB then to PIL
    disp_rgb = cv2.cvtColor(display_img, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(disp_rgb)

    # create a background image sized exactly to label (center the board if aspect differs)
    full_display = Image.new("RGB", (label_w, label_h), (255, 255, 255))
    paste_x = (label_w - disp_w) // 2
    paste_y = (label_h - disp_h) // 2
    full_display.paste(pil_img, (paste_x, paste_y))

    imgtk = ImageTk.PhotoImage(image=full_display)
    video_label.imgtk = imgtk  # keep ref
    video_label.configure(image=imgtk)

    # Show a small camera preview in the control panel
    small = cv2.resize(frame, (CAM_PREVIEW_W, CAM_PREVIEW_H))
    small_rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    cam_pil = Image.fromarray(small_rgb)
    cam_imgtk = ImageTk.PhotoImage(image=cam_pil)
    cam_label.imgtk = cam_imgtk
    cam_label.configure(image=cam_imgtk)

    # queue next update
    video_label.after(10, update_frame)

# ---------------- GUI Controls ----------------
def clear_canvas():
    global internal_canvas
    internal_canvas[:] = 255
    status_label.configure(text="Canvas cleared")

def set_color(color):
    global pen_color
    pen_color = color
    # color is BGR; convert to hex for label
    hex_color = '#%02x%02x%02x' % (color[2], color[1], color[0])
    current_color_label.configure(text="●", text_color=hex_color)
    status_label.configure(text="Pen Color Changed")

def set_brush(val):
    global brush_size
    brush_size = int(float(val))
    status_label.configure(text=f"Brush Size: {brush_size}")

def save_canvas():
    # save the internal canvas (full resolution)
    filename = f"drawing_{int(time.time())}.png"
    cv2.imwrite(filename, internal_canvas)
    status_label.configure(text=f"Saved as {filename}")
    print(f"Saved as {filename}")

def toggle_mode():
    if ctk.get_appearance_mode() == "Dark":
        ctk.set_appearance_mode("Light")
    else:
        ctk.set_appearance_mode("Dark")

def exit_app():
    cap.release()
    hands.close()
    root.destroy()

# ---------------- CustomTkinter Setup ----------------
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

root = ctk.CTk()
root.title("Air Pen🖋️")
root.geometry("1200x750")

# Main Layout
frame_main = ctk.CTkFrame(root, corner_radius=12)
frame_main.pack(padx=10, pady=10, fill="both", expand=True)

# Whiteboard display (will resize dynamically)
video_label = ctk.CTkLabel(frame_main, text="")
video_label.pack(side="left", padx=10, pady=10, fill="both", expand=True)

# Control panel
control_frame = ctk.CTkFrame(frame_main, width=280, corner_radius=12)
control_frame.pack(side="right", padx=10, pady=10, fill="y")

ctk.CTkLabel(control_frame, text="🎨 Tools", font=("Arial", 18, "bold")).pack(pady=10)

# Camera preview inside control panel
ctk.CTkLabel(control_frame, text="📷 Camera Preview", font=("Arial", 14)).pack(pady=5)
cam_label = ctk.CTkLabel(control_frame, text="")
cam_label.pack(pady=5)

ctk.CTkButton(control_frame, text="Clear Canvas", command=clear_canvas).pack(pady=6)
ctk.CTkButton(control_frame, text="Save Drawing", command=save_canvas).pack(pady=6)
ctk.CTkButton(control_frame, text="Toggle Dark/Light", command=toggle_mode).pack(pady=6)
ctk.CTkButton(control_frame, text="Exit", fg_color="red", command=exit_app).pack(pady=16)

# Color palette
ctk.CTkLabel(control_frame, text="Pen Colors:", font=("Arial", 14)).pack(pady=8)
color_frame = ctk.CTkFrame(control_frame, corner_radius=8)
color_frame.pack(pady=6)

current_color_label = ctk.CTkLabel(control_frame, text="●", font=("Arial", 28), text_color="blue")
current_color_label.pack(pady=6)

colors = {
    "Red": (0, 0, 255),
    "Green": (0, 255, 0),
    "Blue": (255, 0, 0),
    "Yellow": (0, 255, 255),
    "Black": (0, 0, 0)
}
for name, bgr in colors.items():
    ctk.CTkButton(color_frame, text=name, width=120, command=lambda c=bgr: set_color(c)).pack(pady=4)

# Brush size
ctk.CTkLabel(control_frame, text="Brush Size:", font=("Arial", 14)).pack(pady=8)
ctk.CTkSlider(control_frame, from_=1, to=60, number_of_steps=59, command=set_brush).pack(pady=6)

# Status bar
status_label = ctk.CTkLabel(root, text="Ready", font=("Arial", 12))
status_label.pack(side="bottom", pady=5, fill="x")

# Start video loop
root.after(100, update_frame)  # small delay to let widgets initialize sizes
root.mainloop()

