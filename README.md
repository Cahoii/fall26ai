DPL302 STUDY SPACE
==================

Bộ ôn tập gồm 252 câu hỏi trắc nghiệm được trích xuất từ file ZIP của bạn.

CÁCH MỞ
-------
Để dùng tài khoản, database và lịch sử (Python 3.10 trở lên, không cần cài thư viện):

1. Mở terminal trong thư mục dự án.
2. Chạy `python server.py`.
3. Mở http://localhost:8000 trên Chrome, Edge hoặc Firefox.
4. Nhấn “Đăng nhập” → “Đăng ký”, sau đó luyện tập hoặc làm bài kiểm tra.
5. Chọn “Lịch sử” để xem các lượt làm bài và chi tiết đáp án.

Có thể đổi cổng bằng `python server.py --port 8080`.
Nếu mở trực tiếp index.html, ứng dụng vẫn hoạt động offline ở chế độ khách;
database và tài khoản chỉ hoạt động khi truy cập qua server.py.

DATABASE VÀ TÀI KHOẢN
--------------------
- Local: SQLite tự tạo tại `data/study.sqlite3` khi chạy server lần đầu.
- Vercel: dùng PostgreSQL (Neon), được cấu hình qua biến môi trường server-only
  `DATABASE_URL` hoặc `POSTGRES_URL`. Không lưu SQLite trên filesystem của Vercel.
- Các bảng: users, sessions, attempts, answers, known_questions.
- Mỗi tài khoản có tiến độ, lịch sử luyện tập và bài kiểm tra riêng.
- Mỗi lượt lưu thời gian, điểm số, câu hỏi, các lựa chọn, đáp án đã chọn,
  đáp án đúng và trạng thái đúng/sai. Câu bỏ trống vẫn được lưu khi nộp bài.
- Lịch sử giữ bản chụp câu hỏi/đáp án tại thời điểm làm bài để việc sửa
  ngân hàng câu hỏi sau này không làm thay đổi kết quả cũ.
- Mật khẩu được băm bằng scrypt với salt riêng; cookie đăng nhập HttpOnly,
  SameSite=Strict, hết hạn sau 7 ngày; tự bật Secure trên Vercel.
  API chỉ cho xem lịch sử của tài khoản hiện tại.
- Gửi lại cùng lượt làm bài khi kết nối gián đoạn không tạo bản ghi trùng.
- Tiến độ khách cũ giữ riêng trong localStorage, không tự gán cho tài khoản mới.
- Lịch sử và tiến độ tài khoản đọc từ database. Ngân hàng câu hỏi đã chỉnh sửa
  hoặc nhập backup vẫn lưu riêng theo tài khoản trên trình duyệt hiện tại.
- Nhập backup khi đăng nhập chỉ nhập ngân hàng câu hỏi; không thay thế điểm số
  hoặc lịch sử trong database. Xuất JSON hiện tại gồm câu hỏi và tổng tiến độ,
  không phải bản sao đầy đủ lịch sử tài khoản.
- Chấm điểm theo bản câu hỏi được gửi lên, phù hợp công cụ tự ôn tập có chỉnh sửa
  đáp án; không dùng kết quả này làm điểm thi chính thức chống gian lận.
- Khi lưu lỗi, giao diện báo lỗi và cho thử lại; không báo đã lưu thành công.

Để backup toàn bộ tài khoản và lịch sử, dừng server rồi sao chép thư mục `data`.
Có thể đặt biến môi trường `DPL302_DB` để đổi vị trí database.
Database và các file tạm SQLite đã được loại khỏi Git.
Server local mặc định chỉ nghe trên máy hiện tại (127.0.0.1).
Nhiều thiết bị dùng chung lịch sử khi kết nối cùng server/database.

DEPLOY VERCEL
-------------
1. Trong project Vercel, mở Storage → Create Database → Neon → chọn gói phù hợp.
2. Connect database với môi trường Production. Integration tự cấp `DATABASE_URL`;
   không đưa URL kết nối hoặc mật khẩu vào HTML, Git hay chat.
3. Push code lên nhánh deploy (main) hoặc tạo deployment mới.
4. Vercel cài `requirements.txt`, chạy `python scripts/build_static.py` để chỉ
   xuất bốn file công khai vào `public`, và deploy `api/index.py` làm Python Function.
5. Rewrite trong `vercel.json` chuyển `/api/*` đến Function. API tự tạo bảng trong
   schema `dpl302` khi nhận yêu cầu đầu tiên; kết nối và truy vấn dùng Neon pooler.
6. Kiểm tra `/api/me`: HTTP 200 với `{"user":null,"progress":null}` khi chưa đăng nhập.
   Đăng ký tài khoản, trả lời câu hỏi, rồi mở Lịch sử để xác minh dữ liệu.

Nếu `/api/me` trả 404: chưa có Function/rewrite trong deployment; deploy lại code mới.
Nếu trả 503 với `DATABASE_NOT_CONFIGURED`: kết nối Neon với đúng môi trường rồi redeploy.
Database giữ dữ liệu qua các lần deploy. SQLite local và Neon là hai database riêng;
tài khoản đã tạo local không tự chuyển lên Neon.
Chỉ kết nối database Production với Production; dùng database/branch riêng cho Preview
nếu cần kiểm thử. Không cho Preview dùng dữ liệu Production khi triển khai rộng rãi.
Các biến môi trường bí mật, thư mục `data`, `.vercel`, `.venv` và `public` không commit.

KIỂM THỬ
--------
Chạy `python -m unittest -v` để kiểm tra API trên localhost với database tạm:
đăng ký/đăng nhập/đăng xuất, tách dữ liệu người dùng, lưu đáp án/câu bỏ trống,
giữ lịch sử, chống ghi trùng, phân trang và chặn truy cập file riêng tư.

TÍNH NĂNG
---------
- Flashcards: xem câu hỏi, lật thẻ để xem đáp án, đánh dấu đã thuộc/cần ôn lại.
- Luyện tập: chọn đáp án và nhận phản hồi ngay.
- Kiểm tra: tạo bài kiểm tra 10/20/50/toàn bộ câu hỏi, xem kết quả sau khi nộp.
- Ngân hàng câu hỏi: tìm kiếm, lọc theo chương, chỉnh sửa câu hỏi/đáp án.
- Xuất backup JSON và CSV; nhập lại backup JSON.
- Tài khoản: lưu tiến độ, lịch sử và đáp án trong SQLite; khách: lưu tiến độ trong localStorage.

DỮ LIỆU
-------
- questions.json: dữ liệu đầy đủ dạng JSON.
- questions.csv: dữ liệu dạng CSV có thể mở bằng Excel.
- 4 nhóm kiến thức, tổng 252 câu.
- 3 ảnh trong ZIP là slide chuyển chương, không phải câu hỏi nên đã loại khỏi bộ ôn tập.
- Đáp án được đối chiếu với answers.csv theo tên ảnh, không dựa vào số thứ tự dòng vì file có cả các slide chuyển chương.

LƯU Ý
-----
Dữ liệu OCR đã được rà soát các lỗi ký hiệu rõ ràng. Bạn có thể sửa trực tiếp câu hỏi, lựa chọn hoặc đáp án trong mục “Ngân hàng câu hỏi”.
Đăng nhập qua server.py để dùng lịch sử tài khoản. Với chế độ khách, hãy xuất backup JSON nếu muốn chuyển tiến độ sang máy khác.
