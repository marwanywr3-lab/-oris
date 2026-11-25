const OrisVoice = {
  recognition: null,
  wakeMode: false,
  isDirectListening: false,
  onCommandCallback: null,
  onStatusCallback: null,

  isSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  init(onCommand, onStatus) {
    this.onCommandCallback = onCommand;
    this.onStatusCallback = onStatus;
    if (!this.isSupported()) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim();
      if (!transcript) return;

      if (this.isDirectListening) {
        this.isDirectListening = false;
        this.onStatusCallback?.("idle");
        this.onCommandCallback?.(transcript);
        if (!this.wakeMode) {
          this.stop();
        }
        return;
      }

      if (this.wakeMode) {
        const cleaned = this.extractWakeCommand(transcript);
        if (cleaned !== null) {
          this.playChime();
          if (cleaned.length > 1) {
            this.onCommandCallback?.(cleaned);
          } else {
            // User only said "Hi Oris", capture the very next phrase
            this.isDirectListening = true;
            this.onStatusCallback?.("listening");
          }
        }
      }
    };

    this.recognition.onerror = (e) => {
      if (e.error === "not-allowed") {
        this.wakeMode = false;
        this.isDirectListening = false;
        this.onStatusCallback?.("denied");
      }
    };

    this.recognition.onend = () => {
      if (this.wakeMode || this.isDirectListening) {
        try {
          this.recognition.start();
        } catch (_) {}
      } else {
        this.onStatusCallback?.("idle");
      }
    };
  },

  extractWakeCommand(text) {
    const patterns = [
      /^(?:hi|hey|hello)\s+oris[\s,،.!?]*/i,
      /^(?:مرحبا|أهلا|اهلا|يا)\s+(?:oris|أوريس|اوريس)[\s,،.!?]*/i,
      /(?:hi oris|hey oris|مرحبا oris|مرحبا اوريس|مرحبا أوريس|يا اوريس|يا أوريس)[\s,،.!?]*/i
    ];

    for (const regex of patterns) {
      const match = text.match(regex);
      if (match) {
        const idx = match.index + match[0].length;
        return text.slice(idx).trim();
      }
    }
    return null;
  },

  setLang(lang) {
    if (this.recognition) {
      this.recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
    }
  },

  setWakeMode(enabled, lang) {
    if (!this.isSupported()) return false;
    this.wakeMode = enabled;
    this.setLang(lang);
    if (enabled) {
      try {
        this.recognition.start();
        this.onStatusCallback?.("wake");
      } catch (_) {}
    } else if (!this.isDirectListening) {
      this.stop();
    }
    return true;
  },

  listenOnce(lang) {
    if (!this.isSupported()) return false;
    this.setLang(lang);
    this.isDirectListening = true;
    this.onStatusCallback?.("listening");
    try {
      this.recognition.start();
    } catch (_) {}
    return true;
  },

  stop() {
    this.isDirectListening = false;
    try {
      this.recognition?.stop();
    } catch (_) {}
    this.onStatusCallback?.("idle");
  },

  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch (_) {}
  }
};
