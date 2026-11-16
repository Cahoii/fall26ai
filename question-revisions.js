// Targeted OCR corrections; apply only to matching bundled questions, preserving personal edits.
(function(root){
  const revisions = [
  {
    "before": {
      "id": 66,
      "section": "RNN, NLP & Attention",
      "question": "What is the softmax loss for one example?",
      "options": {
        "A": "(¥ - yf",
        "B": "-2; yj log yj",
        "C": "max(0, 1 - yy)",
        "D": "-log(1 - y)"
      },
      "answer": "B",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000303.png",
      "correctText": "-2; yj log yj",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 66,
      "section": "RNN, NLP & Attention",
      "question": "What is the softmax loss for one example?",
      "options": {
        "A": "\\((\\hat{y}-y)^2\\)",
        "B": "\\(-\\sum_j y_j\\log\\hat{y}_j\\)",
        "C": "\\(\\max(0,\\,1-y\\hat{y})\\)",
        "D": "\\(-\\log(1-\\hat{y})\\)"
      },
      "answer": "B",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000303.png",
      "correctText": "\\(-\\sum_j y_j\\log\\hat{y}_j\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 102,
      "section": "Convolutional Neural Networks",
      "question": "What is the total weight shape of convolution layer l?",
      "options": {
        "A": "f^(l) × f^(l) × n_c^(l−1) × n_c^(l)",
        "B": "n_H^(l) × n_W^(l) × n_c^(l)",
        "C": "f^(l) × f^(l)",
        "D": "1 × 1 × 1 × n_c^(l)"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000648.png",
      "correctText": "f^(l) × f^(l) × n_c^(l−1) × n_c^(l)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 102,
      "section": "Convolutional Neural Networks",
      "question": "What is the total weight shape of convolution layer \\(l\\)?",
      "options": {
        "A": "\\(f^{(l)}\\times f^{(l)}\\times n_c^{(l-1)}\\times n_c^{(l)}\\)",
        "B": "\\(n_H^{(l)}\\times n_W^{(l)}\\times n_c^{(l)}\\)",
        "C": "\\(f^{(l)}\\times f^{(l)}\\)",
        "D": "\\(1\\times1\\times1\\times n_c^{(l)}\\)"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000648.png",
      "correctText": "\\(f^{(l)}\\times f^{(l)}\\times n_c^{(l-1)}\\times n_c^{(l)}\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 113,
      "section": "Convolutional Neural Networks",
      "question": "In a residual block, how is a^[l+2] computed?",
      "options": {
        "A": "a^[l+2] = g(z^[l+2])",
        "B": "a^[l+2] = a^[l]",
        "C": "a^[l+2] = g(z^[l+2] + a^[l])",
        "D": "a^[l+2] = z^[l+2] − a^[l]"
      },
      "answer": "C",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000729.png",
      "correctText": "a^[l+2] = g(z^[l+2] + a^[l])",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 113,
      "section": "Convolutional Neural Networks",
      "question": "In a residual block, how is \\(a^{(l+2)}\\) computed?",
      "options": {
        "A": "\\(a^{(l+2)}=g\\left(z^{(l+2)}\\right)\\)",
        "B": "\\(a^{(l+2)}=a^{(l)}\\)",
        "C": "\\(a^{(l+2)}=g\\left(z^{(l+2)}+a^{(l)}\\right)\\)",
        "D": "\\(a^{(l+2)}=z^{(l+2)}-a^{(l)}\\)"
      },
      "answer": "C",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000729.png",
      "correctText": "\\(a^{(l+2)}=g\\left(z^{(l+2)}+a^{(l)}\\right)\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 115,
      "section": "Convolutional Neural Networks",
      "question": "In ResNet, what is done if z^[l+2] and a^[l] have different dimensions?",
      "options": {
        "A": "The skip connection is removed",
        "B": "Max pooling is applied to z",
        "C": "The block is skipped",
        "D": "a^[l] is multiplied by a matrix W_s"
      },
      "answer": "D",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000738.png",
      "correctText": "a^[l] is multiplied by a matrix W_s",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 115,
      "section": "Convolutional Neural Networks",
      "question": "In ResNet, what is done if \\(z^{(l+2)}\\) and \\(a^{(l)}\\) have different dimensions?",
      "options": {
        "A": "The skip connection is removed",
        "B": "Max pooling is applied to \\(z\\)",
        "C": "The block is skipped",
        "D": "\\(a^{(l)}\\) is multiplied by a matrix \\(W_s\\)"
      },
      "answer": "D",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000738.png",
      "correctText": "\\(a^{(l)}\\) is multiplied by a matrix \\(W_s\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 128,
      "section": "Convolutional Neural Networks",
      "question": "What is the target label y when there is no object in the image?",
      "options": {
        "A": "All zeros",
        "B": "[1, ?, ?, ?, ?, ?, ?, ?]",
        "C": "[0, 0, 0, 0, 0, 1, 0, 0]",
        "D": "[0, ?, ?, ?, ?, ?, ?, ?], where \"2\" means don't care"
      },
      "answer": "D",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000837.png",
      "correctText": "[0, ?, ?, ?, ?, ?, ?, ?], where \"2\" means don't care",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 128,
      "section": "Convolutional Neural Networks",
      "question": "What is the target label \\(y\\) when there is no object in the image?",
      "options": {
        "A": "All zeros",
        "B": "\\([1,\\,?,\\,?,\\,?,\\,?,\\,?,\\,?,\\,?]\\)",
        "C": "\\([0,\\,0,\\,0,\\,0,\\,0,\\,1,\\,0,\\,0]\\)",
        "D": "\\([0,\\,?,\\,?,\\,?,\\,?,\\,?,\\,?,\\,?]\\), where \"?\" means don't care"
      },
      "answer": "D",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 000837.png",
      "correctText": "\\([0,\\,?,\\,?,\\,?,\\,?,\\,?,\\,?,\\,?]\\), where \"?\" means don't care",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  }
];
  const byId=new Map(revisions.map(revision=>[revision.before.id,revision]));
  function applyQuestionRevisions(questions){
    return questions.map(question=>{
      const revision=byId.get(question.id);
      if(!revision)return question;
      const {before,after}=revision;
      if(question.sourceImage!==before.sourceImage||![before.question,after.question].includes(question.question))return question;
      const next={...question,options:{...question.options}};
      if(next.question===before.question)next.question=after.question;
      for(const key of Object.keys(after.options)){
        if(next.options[key]===before.options[key])next.options[key]=after.options[key];
      }
      if(next.correctText===before.correctText)next.correctText=next.options[next.answer];
      return next;
    });
  }
  root.applyQuestionRevisions=applyQuestionRevisions;
  if(typeof module!=='undefined')module.exports={applyQuestionRevisions,revisions};
})(globalThis);
