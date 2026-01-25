# SOP: Frequency Management and Signal Processing Guidelines
**Category:** Audio Engineering / Technical Standards  
**Version:** 1.0  
**Scope:** Mixing, Mastering, and Sound Design Workflows

---

## 1. Frequency Spectrum Allocation
To ensure clarity and prevent "masking" in a mix, all engineers must adhere to the following frequency response standards.

| Frequency Range | Character | Technical Action |
| :--- | :--- | :--- |
| **20Hz – 60Hz** | Sub-Bass | Use high-pass filters (HPF) on non-bass elements to clear headroom. |
| **200Hz – 500Hz** | Low-Mids / Mud | Attenuate narrow bands if the mix feels "cluttered" or "boxy." |
| **2kHz – 4kHz** | Presence / Attack | Critical range for percussion "snap" and vocal clarity. Use caution; excessive gain causes listener fatigue. |
| **10kHz – 20kHz** | Air / Brilliance | Subtle high-shelf boosts for "expensive" sounding textures. |

---

## 2. Dynamic Processing Standards
Compression and transient shaping must be applied based on the "Envelope Profile" of the source material.

### 2.1 Transient Classification


* **Percussive Transients:** Short attack times (1ms–10ms) to tame peaks.
* **Sustained Textures:** Longer attack times to preserve the natural "hit" of the instrument while controlling the tail.

### 2.2 Signal Flow Protocol
For consistent results, follow this standard signal chain order:
1.  **Corrective EQ:** Remove unwanted resonances.
2.  **Dynamics:** Control peaks and RMS levels.
3.  **Tonal EQ:** Shape the character of the sound.
4.  **Temporal Effects:** Reverb and Delay (via Auxiliary Sends).

---

## 3. Mixing Best Practices (Internal)
* **A/B Comparison:** Use level-matched bypass to ensure processing is genuinely improving the signal.
* **Phase Correlation:** Check low-frequency elements (Kicks and Bass) in Mono to ensure no phase cancellation is occurring.
* **Headroom:** Maintain a minimum of -6dB peak on the Master Bus before entering the mastering stage.