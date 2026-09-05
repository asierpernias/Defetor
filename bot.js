export default function bot({memory, history}){
    memory ??= {
        rounds: 0,
        cooperations: 0,
        defections: 0,
        model: {
            C: {C: 1, D: 1},
            D: {C: 1, D: 1}
        }
    };

    memory.rounds++;
    const move = "C";

    // Keep a count of the moves and update the memory counter

    const lastMove = history.at(-1)?.opponent;

    if (lastMove === "C"){
        memory.cooperations++;
    } else if (lastMove === "D"){
        memory.defections++;
    }

    memory.rounds = memory.cooperations + memory.defections;


    // Calculate defect rate in diffferent windows 

    function defectRate(history, n){
        const recent = history.slice(-n);
        if (recent.length === 0) return 0

        return recent.filter(x => x.opponent === "D").length / recent.length;
    }

    const d5 = defectRate(history, 5);
    const d10 = defectRate(history, 10);
    const d30 = defectRate(history, 30)

    const prediction =
        0.5 * d5 +
        0.3 * d10 +
        0.2 * d30;


    const previous = history.at(-1);
    if (previous){
        memory.model[previous.you][previous.opponent]++;
    }

    // Probability

    function probab(model, ourMove){
        const data = model[ourMove];

        return data.D / (data.C + data.D)
    }

    const pDifC = probab(memory.model, "C");
    const pDifD = probab(memory.model, "D")

    const expectedD = (1 - pDifD) * 2 + pDifD * 1;
    const expectedC = (1 - pDifC) * 2 + pDifC * 0;

    if (prediction > 0.75){
        move = "D";
    } else if (expectedD > expectedC){
        move = "C";
    } else {
        move = "C";
    }
    return[move, memory]
}