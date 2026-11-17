# Nội dung đối chiếu với ảnh gốc ngày 17/11/2026

Ký hiệu lớp dùng số mũ dạng `(l)` theo ảnh gốc. Ký hiệu ⊙ là phép nhân từng phần tử; T là chuyển vị.

## Câu 203

In a 2-layer network, how is \(\mathrm{d}Z^{(1)}\) computed?

- **A.** \(\mathrm{d}Z^{(1)}=A^{(1)}-Y\)
- **B.** \(\mathrm{d}Z^{(1)}=\left((W^{(2)})^{\mathsf{T}}\mathrm{d}Z^{(2)}\right)\odot g^{(1)\prime}\!\left(Z^{(1)}\right)\)
- **C.** \(\mathrm{d}Z^{(1)}=W^{(1)}X\)
- **D.** \(\mathrm{d}Z^{(1)}=\operatorname{np.sum}\!\left(\mathrm{d}Z^{(2)}\right)\)

**Đáp án đúng: B.**

## Câu 209

What is the shape of \(W^{(l)}\)?

- **A.** \(\left(n^{(l)},\,n^{(l-1)}\right)\)
- **B.** \(\left(n^{(l-1)},\,n^{(l)}\right)\)
- **C.** \(\left(n^{(l)},\,1\right)\)
- **D.** \(\left(n^{(l)},\,m\right)\)

**Đáp án đúng: A.**

## Câu 210

What is the shape of \(b^{(l)}\)?

- **A.** \(\left(1,\,n^{(l)}\right)\)
- **B.** \(\left(n^{(l-1)},\,1\right)\)
- **C.** \(\left(n^{(l)},\,m\right)\)
- **D.** \(\left(n^{(l)},\,1\right)\)

**Đáp án đúng: D.**

## Câu 211

In the example with \(n^{(0)}=2\) and \(n^{(1)}=3\), what is the shape of \(W^{(1)}\)?

- **A.** \((2,\,3)\)
- **B.** \((3,\,2)\)
- **C.** \((3,\,1)\)
- **D.** \((2,\,1)\)

**Đáp án đúng: B.**

## Câu 229

Why is \(L_2\) regularization also called "weight decay"?

- **A.** Weights are deleted after each epoch
- **B.** The learning rate decays over time
- **C.** Each update multiplies \(W\) by \(\left(1-\frac{\alpha\lambda}{m}\right)\), shrinking it
- **D.** Weights decay to exactly zero

**Đáp án đúng: C.**

## Câu 231

How is the regularization parameter \(\lambda\) usually chosen?

- **A.** Using the dev set
- **B.** Using the test set
- **C.** It is always 1
- **D.** It equals the learning rate

**Đáp án đúng: A.**

## Câu 237

How should the test set be normalized?

- **A.** With the same \(\mu\) and \(\sigma\) computed on the training set
- **B.** With its own \(\mu\) and \(\sigma\)
- **C.** It should not be normalized
- **D.** With \(\mu=0\) and \(\sigma=1\) for every feature by definition

**Đáp án đúng: A.**

## Câu 248

With \(\beta=0.9\), an exponentially weighted average roughly averages over how many recent values?

- **A.** About 10
- **B.** About 2
- **C.** About 50
- **D.** About 1000

**Đáp án đúng: A.**
