export default function bot({memory, history}){
    try {    memory ??= {
            rounds: 0,
            cooperations: 0,
            defections: 0,
            model: {
                C: {C: 1, D: 1},
                D: {C: 1, D: 1}
            },
            markov2: {},
            patBuf: [],
            consecutiveD: 0,
            recentModel: {C: {C: 1, D: 1}, D: {C:1, D: 1}},
            recentWindow: 0,
        };

        let move = "C";

        const lastMove = history.at(-1)?.opponent;

        if (lastMove === "C"){
            memory.cooperations++;
        } else if (lastMove === "D"){
            memory.defections++;
        }
        if (lastMove){ 
            memory.patBuf.push(lastMove);
            if (memory.patBuf.length > 20) memory.patBuf.shift();
        }

        memory.rounds = memory.cooperations + memory.defections;

        // defect rate con decay exponencial
        function defectRate(history, n, decay = 0.85){
            const recent = history.slice(-n);
            if (recent.length === 0) return 0;
            let weight = 1, totalW = 0, defW = 0;
            for (let i = recent.length -1; i >= 0; i--){
                if (recent[i].opponent === "D") defW += weight;
                totalW += weight;
                weight *= decay;
            }
            return defW / totalW
        }

        const d5  = defectRate(history, 5,  0.80);
        const d10 = defectRate(history, 10, 0.85);
        const d30 = defectRate(history, 30, 0.90);

        const alwaysD = memory.defections >= 5 && memory.cooperations === 0;

        const previous = history.at(-1);
        if (previous){
            memory.model[previous.you][previous.opponent]++;
            memory.recentModel[previous.you][previous.opponent]++;
            memory.recentWindow++;
            if (memory.recentWindow >= 20){
                memory.recentModel = {C: {C: 1, D: 1}, D: {C: 1, D: 1}};
                memory.recentWindow = 0;
            }
        }

        const longCooperation = memory.cooperations >= 10 && memory.defections === 0;

        const unprovokedDefection = previous && previous.you === "C" && previous.opponent === "D";

        const mutualDefection = previous && previous.you === "D" && previous.opponent === "D";

        function probDefect(model, ourMove){
            const data = model[ourMove];
            return data.D / (data.C + data.D)
        }

        const recentSamples = memory.recentModel.C.C + memory.recentModel.C.D +
                              memory.recentModel.D.C + memory.recentModel.D.D - 4;
        const recentW = Math.min(recentSamples / 10, 0.7);

        const pDifC = recentW * probDefect(memory.recentModel, "C") + (1 - recentW) * probDefect(memory.model, "C");
        const pDifD = recentW * probDefect(memory.recentModel, "D") + (1 - recentW) * probDefect(memory.model, "D");

        const cSamples = memory.model.C.C + memory.model.C.D - 2;
        const dSamples = memory.model.D.C + memory.model.D.D - 2;

        const expectedD = (1 - pDifD) * 3 + pDifD * 1;
        const expectedC = (1 - pDifC) * 2 + pDifC * 0;

        if (previous && history.at(-2)){
            const key = `${history.at(-2).you}${history.at(-2).opponent}`;
            memory.markov2[key] ??= { C: 1, D: 1};  
            memory.markov2[key][previous.opponent]++;
        }

        const m2key = previous ? `${previous.you}${previous.opponent}` : null;
        const m2data = m2key ? memory.markov2[m2key] : null;
        const mpred = m2data && (m2data.C + m2data.D) > 3
            ? m2data.D / (m2data.C + m2data.D)
            : null;

        const markovWeight = mpred !== null ? Math.min(0.25 + history.length / 200, 0.5) : 0;
        const prediction = mpred !== null   
            ? markovWeight * mpred + (1 - markovWeight) * (0.6 * d5 + 0.4 * d10)
            : 0.5 * d5 + 0.3 * d10 + 0.2 * d30;

        function detectPeriod() {
            const buf = memory.patBuf;
            for (let p = 2; p <= 5; p++){
                if (buf.length < p * 3) continue;
                const last   = buf.slice(-p).join("");
                const prev   = buf.slice(-p*2, -p).join("");
                const before = buf.slice(-p*3, -p*2).join("");
                if (last === prev && prev === before){
                    return buf.slice(-p);
                }
            }
            return null
        }

        const period = detectPeriod();
        if (period){
            move = period.includes("D") ? "D" : "C";
            return [move, memory];
        }

        if (previous?.opponent === "D" && previous.you === "D") memory.consecutiveD = (memory.consecutiveD ?? 0) + 1;
        else memory.consecutiveD = 0;

        // Detect  pattern tit for tat

        function detectTFT(history){
            if (history.length < 6) return false;
            const sample = history.slice(-6);
            return sample.slice(1).every((r, i) => r.opponent === sample[i].you);
        }

        function detectGTFT(history){
            if (history.length < 10) return false;
            const sample = history.slice(-10);
            const copies = sample.slice(1).filter((r, i) => r.opponent === sample[i].you).length;
            return copies >= 8;
        }

        const isTFT = detectTFT(history);
        const isGTFT = detectGTFT(history);

        if (isGTFT && !isTFT){
            move = history.length % 4 === 3 ? "D" : "C";
            return [move, memory];
        }

        if (isTFT){
            move = "C";
            return [move, memory]
        }

        // Logic of answer

        const volativity = Math.abs(d5 - d10);
        const threshold = 0.55 + 0.15 * (1 - volativity);

        if (cSamples < 2 && dSamples < 2){
            move = "C";
        } else if (alwaysD){
            move = "D";
        } else if(memory.consecutiveD >= 3 && memory.cooperations > 0){
            move = "C"
        } else if (unprovokedDefection && pDifC > 0.65 && cSamples >= 3){
            move = "D";
        } else if (prediction > threshold && history.length >= 5 && !mutualDefection){
            move = "D";
        } else if (expectedD > expectedC && dSamples >= 3 && !mutualDefection){
            move = "D";
        } else {
            move = "C";
        }

        return[move, memory]
    } catch(e) {
        return ["C", memory ?? null];
    }
}