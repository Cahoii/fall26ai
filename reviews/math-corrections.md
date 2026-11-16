# Nội dung câu hỏi đã đối chiếu với ảnh gốc

Dùng ký hiệu lớp dạng số mũ `(l)` theo ảnh gốc. Ảnh 4 và ảnh 6 cùng là câu 115.

## Câu 66

What is the softmax loss for one example?

- **A.** \((\hat{y}-y)^2\)
- **B.** \(-\sum_j y_j\log\hat{y}_j\)
- **C.** \(\max(0,\,1-y\hat{y})\)
- **D.** \(-\log(1-\hat{y})\)

**Đáp án đúng: B.**

## Câu 102

What is the total weight shape of convolution layer \(l\)?

- **A.** \(f^{(l)}\times f^{(l)}\times n_c^{(l-1)}\times n_c^{(l)}\)
- **B.** \(n_H^{(l)}\times n_W^{(l)}\times n_c^{(l)}\)
- **C.** \(f^{(l)}\times f^{(l)}\)
- **D.** \(1\times1\times1\times n_c^{(l)}\)

**Đáp án đúng: A.**

## Câu 113

In a residual block, how is \(a^{(l+2)}\) computed?

- **A.** \(a^{(l+2)}=g\left(z^{(l+2)}\right)\)
- **B.** \(a^{(l+2)}=a^{(l)}\)
- **C.** \(a^{(l+2)}=g\left(z^{(l+2)}+a^{(l)}\right)\)
- **D.** \(a^{(l+2)}=z^{(l+2)}-a^{(l)}\)

**Đáp án đúng: C.**

## Câu 115

In ResNet, what is done if \(z^{(l+2)}\) and \(a^{(l)}\) have different dimensions?

- **A.** The skip connection is removed
- **B.** Max pooling is applied to \(z\)
- **C.** The block is skipped
- **D.** \(a^{(l)}\) is multiplied by a matrix \(W_s\)

**Đáp án đúng: D.**

## Câu 128

What is the target label \(y\) when there is no object in the image?

- **A.** All zeros
- **B.** \([1,\,?,\,?,\,?,\,?,\,?,\,?,\,?]\)
- **C.** \([0,\,0,\,0,\,0,\,0,\,1,\,0,\,0]\)
- **D.** \([0,\,?,\,?,\,?,\,?,\,?,\,?,\,?]\), where "?" means don't care

**Đáp án đúng: D.**
