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
  },
  {
    "before": {
      "id": 203,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "In a 2-layer network, how is dZ^(1) computed?",
      "options": {
        "A": "dZ^(1) = A^(1) − Y",
        "B": "dZ^(1) = (W^(2).T @ dZ^(2)) element-wise multiplied by g′^(1)(Z^(1))",
        "C": "dZ^(1) = W^(1) @ X",
        "D": "dZ^(1) = np.sum(dZ^(2))"
      },
      "answer": "B",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002007.png",
      "correctText": "dZ^(1) = (W^(2).T @ dZ^(2)) element-wise multiplied by g′^(1)(Z^(1))",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 203,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "In a 2-layer network, how is \\(\\mathrm{d}Z^{(1)}\\) computed?",
      "options": {
        "A": "\\(\\mathrm{d}Z^{(1)}=A^{(1)}-Y\\)",
        "B": "\\(\\mathrm{d}Z^{(1)}=\\left((W^{(2)})^{\\mathsf{T}}\\mathrm{d}Z^{(2)}\\right)\\odot g^{(1)\\prime}\\!\\left(Z^{(1)}\\right)\\)",
        "C": "\\(\\mathrm{d}Z^{(1)}=W^{(1)}X\\)",
        "D": "\\(\\mathrm{d}Z^{(1)}=\\operatorname{np.sum}\\!\\left(\\mathrm{d}Z^{(2)}\\right)\\)"
      },
      "answer": "B",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002007.png",
      "correctText": "\\(\\mathrm{d}Z^{(1)}=\\left((W^{(2)})^{\\mathsf{T}}\\mathrm{d}Z^{(2)}\\right)\\odot g^{(1)\\prime}\\!\\left(Z^{(1)}\\right)\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 209,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "What is the shape of W^(l)?",
      "options": {
        "A": "(n^(l), n^(l−1))",
        "B": "(n^(l−1), n^(l))",
        "C": "(n^(l), 1)",
        "D": "(n^(l), m)"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002430.png",
      "correctText": "(n^(l), n^(l−1))",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 209,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "What is the shape of \\(W^{(l)}\\)?",
      "options": {
        "A": "\\(\\left(n^{(l)},\\,n^{(l-1)}\\right)\\)",
        "B": "\\(\\left(n^{(l-1)},\\,n^{(l)}\\right)\\)",
        "C": "\\(\\left(n^{(l)},\\,1\\right)\\)",
        "D": "\\(\\left(n^{(l)},\\,m\\right)\\)"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002430.png",
      "correctText": "\\(\\left(n^{(l)},\\,n^{(l-1)}\\right)\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 210,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "What is the shape of b^(l)?",
      "options": {
        "A": "(1, n^(l))",
        "B": "(n, 1)",
        "C": "(n^(l), m)",
        "D": "(n^(l), 1)"
      },
      "answer": "D",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002434.png",
      "correctText": "(n^(l), 1)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 210,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "What is the shape of \\(b^{(l)}\\)?",
      "options": {
        "A": "\\(\\left(1,\\,n^{(l)}\\right)\\)",
        "B": "\\(\\left(n^{(l-1)},\\,1\\right)\\)",
        "C": "\\(\\left(n^{(l)},\\,m\\right)\\)",
        "D": "\\(\\left(n^{(l)},\\,1\\right)\\)"
      },
      "answer": "D",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002434.png",
      "correctText": "\\(\\left(n^{(l)},\\,1\\right)\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 211,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "In the example with n^(0) = 2 and n^(1) = 3, what is the shape of W^(1)?",
      "options": {
        "A": "(2, 3)",
        "B": "(3, 2)",
        "C": "(3, 1)",
        "D": "(2, 1)"
      },
      "answer": "B",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002439.png",
      "correctText": "(3, 2)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 211,
      "section": "Sequence Models & Neural Network Fundamentals",
      "question": "In the example with \\(n^{(0)}=2\\) and \\(n^{(1)}=3\\), what is the shape of \\(W^{(1)}\\)?",
      "options": {
        "A": "\\((2,\\,3)\\)",
        "B": "\\((3,\\,2)\\)",
        "C": "\\((3,\\,1)\\)",
        "D": "\\((2,\\,1)\\)"
      },
      "answer": "B",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002439.png",
      "correctText": "\\((3,\\,2)\\)",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 229,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "Why is L2 regularization also called \"weight decay\"?",
      "options": {
        "A": "Weights are deleted after each epoch",
        "B": "The learning rate decays over time",
        "C": "Each update multiplies W by (1 - aA/m), shrinking it",
        "D": "Weights decay to exactly zero"
      },
      "answer": "C",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002548.png",
      "correctText": "Each update multiplies W by (1 - aA/m), shrinking it",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 229,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "Why is \\(L_2\\) regularization also called \"weight decay\"?",
      "options": {
        "A": "Weights are deleted after each epoch",
        "B": "The learning rate decays over time",
        "C": "Each update multiplies \\(W\\) by \\(\\left(1-\\frac{\\alpha\\lambda}{m}\\right)\\), shrinking it",
        "D": "Weights decay to exactly zero"
      },
      "answer": "C",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002548.png",
      "correctText": "Each update multiplies \\(W\\) by \\(\\left(1-\\frac{\\alpha\\lambda}{m}\\right)\\), shrinking it",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 231,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "How is the regularization parameter A usually chosen?",
      "options": {
        "A": "Using the dev set",
        "B": "Using the test set",
        "C": "It is always 1",
        "D": "It equals the learning rate"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002554.png",
      "correctText": "Using the dev set",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 231,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "How is the regularization parameter \\(\\lambda\\) usually chosen?",
      "options": {
        "A": "Using the dev set",
        "B": "Using the test set",
        "C": "It is always 1",
        "D": "It equals the learning rate"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 002554.png",
      "correctText": "Using the dev set",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 237,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "How should the test set be normalized?",
      "options": {
        "A": "With the same py and o computed on the training set",
        "B": "With its own p and o",
        "C": "It should not be normalized",
        "D": "With p = 0 and o = 1 for every feature by definition"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 003754.png",
      "correctText": "With the same py and o computed on the training set",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 237,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "How should the test set be normalized?",
      "options": {
        "A": "With the same \\(\\mu\\) and \\(\\sigma\\) computed on the training set",
        "B": "With its own \\(\\mu\\) and \\(\\sigma\\)",
        "C": "It should not be normalized",
        "D": "With \\(\\mu=0\\) and \\(\\sigma=1\\) for every feature by definition"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 003754.png",
      "correctText": "With the same \\(\\mu\\) and \\(\\sigma\\) computed on the training set",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    }
  },
  {
    "before": {
      "id": 248,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "With B = 0.9, an exponentially weighted average roughly averages over how many recent values?",
      "options": {
        "A": "About 10",
        "B": "About 2",
        "C": "About 50",
        "D": "About 1000"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 003846.png",
      "correctText": "About 10",
      "answerSource": "answers.csv — đối chiếu theo tên ảnh"
    },
    "after": {
      "id": 248,
      "section": "Improving Deep Neural Networks & ML Strategy",
      "question": "With \\(\\beta=0.9\\), an exponentially weighted average roughly averages over how many recent values?",
      "options": {
        "A": "About 10",
        "B": "About 2",
        "C": "About 50",
        "D": "About 1000"
      },
      "answer": "A",
      "sourceImage": "Ảnh chụp màn hình 2026-11-08 003846.png",
      "correctText": "About 10",
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
