# TOKEN TO ACTION — research and edit notes

15-second editorial montage of selected milestones in modern LLMs and chat agents. Research cutoff: October 7, 2026. This is a selective timeline, not an exhaustive history of language modeling or chatbots. All graphics and music are generated procedurally by render.py.

| On-screen date | Milestone | Primary source |
| --- | --- | --- |
| 2017 | Transformer architecture | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) |
| 2018–2020 | GPT, GPT-2, GPT-3; 175B refers specifically to GPT-3 | [Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165), [GPT-4 retrospective](https://openai.com/index/gpt-4/) |
| 2022 | ChatGPT launched November 30 | [Introducing ChatGPT](https://openai.com/index/chatgpt/) |
| 2023 | GPT-4, Claude, Gemini | [GPT-4](https://openai.com/index/gpt-4/), [Claude](https://www.anthropic.com/news/introducing-claude), [Gemini](https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/) |
| 2024 | o1 and inference-time reasoning | [Learning to reason with LLMs](https://openai.com/index/learning-to-reason-with-llms/) |
| 2025 | ChatGPT agent combines conversation and tool use | [Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) |
| 2026 | GPT-6.1 Sol and Claude Opus 5.5 | [GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/), [Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5) |

The phrases “from words to worlds” and “models reason, agents act” are editorial framing, not claims of consciousness or universally reliable autonomy.

## Deliverables

- `output/TOKEN-TO-ACTION.mp4`: 1920 × 1080, 60 fps, 15 seconds, H.264 + stereo AAC.
- `output/score.wav`: original electronic score, 120 BPM, stereo 48 kHz.
- `output/poster.jpg` and `output/storyboard.jpg`.
- `render.py`: editable source, including timing, graphics, and synthesis.

Render with Python 3.12, Pillow, NumPy, and imageio-ffmpeg. The encoder package is installed locally in `.render-deps`.
