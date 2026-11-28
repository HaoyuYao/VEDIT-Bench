# 🎬 VEDIT-Bench

**VEDIT-Bench: A Unified Benchmark for Evaluating Coding Agents on Programmatic Video Editing from Undescribed Instructions**

[🌐 Project Page](https://haoyuyao.github.io/VEDIT-Bench) | [💻 GitHub Code](https://github.com/HaoyuYao/VEDIT-Bench) | [🤗 Hugging Face Dataset](https://huggingface.co/datasets/Jack123456aas/VEDIT-Bench)

VEDIT-Bench evaluates coding agents on programmatic video editing given only a source video and an underspecified editing instruction. It contains **678 tasks across 226 scenes and 7 domains**, with three difficulty levels: local edits (L1), linked updates (L2), and rule or structural changes (L3).

This repository provides the evaluation code. The benchmark data and paper results are available on Hugging Face.

## 🛠️ 1. Installation

Requires Python 3.12, Node.js, and npm.

```bash
git clone https://github.com/HaoyuYao/VEDIT-Bench.git
cd VEDIT-Bench/evaluation

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

npm install -g @openai/codex@0.171.0-alpha.13.2
codex login
python run.py doctor
```

The default semantic judge is `gpt-6.1-terra` with `high` reasoning effort.

## 📦 2. Prepare Data

Download the benchmark from [Hugging Face](https://huggingface.co/datasets/Jack123456aas/VEDIT-Bench).

```bash
pip install huggingface_hub
hf download Jack123456aas/VEDIT-Bench --repo-type dataset --local-dir ../VEDIT-Bench
```

Arrange the benchmark files and edited outputs as follows:

```text
benchmark/
├── data/
│   └── <domain>/<scene>/
│       ├── source.mp4
│       └── L1/
│           ├── instruction.txt
│           ├── eval.json
│           └── reference.mp4
└── model_a/
    └── <domain>/<scene>/L1/
        └── edited.mp4
```

## 🚀 3. Run Evaluation

Run all commands from the `evaluation/` directory.

**Evaluate all models and tasks:**

```bash
python run.py evaluate --root ../benchmark --output ../runs
```

**Evaluate a specific model and task:**

```bash
python run.py evaluate --root ../benchmark --output ../trial \
    --models model_a --tasks charts/01-trend/L2
```

Replace the example model name and task ID with your own.

## 📝 Citation

```bibtex
@article{yao2026veditbench,
  title={VEDIT-Bench: A Unified Benchmark for Evaluating Coding Agents on Programmatic Video Editing from Undescribed Instructions},
  author={Yao, Haoyu and Lin, Chenguo and Xiang, Yike and Du, Ruize and Ran, Fengyuan and Hu, Qingmiao and Duan, Xuesong and Mu, Yadong},
  year={2026}
}
```

## 📄 Contact

yaohaoyu26@stu.pku.edu.cn
