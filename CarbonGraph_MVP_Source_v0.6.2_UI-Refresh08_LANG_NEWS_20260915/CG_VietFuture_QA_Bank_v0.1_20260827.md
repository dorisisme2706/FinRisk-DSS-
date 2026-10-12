# CARBONGRAPH – VIETFUTURE Q&A BANK v0.1

Ngày cập nhật: 27/08/2026  
Phạm vi: chuẩn bị phần hỏi–đáp cho CarbonGraph MVP v0.6.2.  
Quy tắc trả lời: không suy đoán số phát thải, không dùng từ “verified/compliant”, và luôn nêu rõ dữ liệu giả lập khi câu hỏi chạm tới kết quả.

## Nhóm 1 – Vấn đề và người dùng

**1. CarbonGraph giải quyết vấn đề gì?**  
CarbonGraph giúp nhóm xuất khẩu thép tổ chức dữ liệu, kiểm tra thiếu sót và truy vết bằng chứng trước khi đi vào bước tính toán hoặc thẩm tra. Bản thi giới hạn ở một sản phẩm, một cơ sở và kỳ 2026.

**2. Người dùng chính là ai?**  
Nhân sự môi trường/ESG, xuất nhập khẩu và kiểm soát dữ liệu tại doanh nghiệp thép; người duyệt và chuyên gia phương pháp là nhóm sử dụng thứ hai.

**3. Vì sao không dùng bảng tính?**  
Bảng tính phù hợp để tính nhanh nhưng khó duy trì liên kết giữa trường dữ liệu, nguồn, rule, issue và quyết định phát hành. CarbonGraph tập trung vào trạng thái và chuỗi bằng chứng có thể truy lại.

**4. Điểm đau lớn nhất là gì?**  
Dữ liệu đến từ nhiều bộ phận, khác tên và khác kỳ; thiếu nguồn có thể bị biến nhầm thành số 0. CarbonGraph dùng nguyên tắc fail-closed để biến thiếu dữ liệu thành blocker hiển thị rõ.

**5. Lợi ích đo bằng gì nếu chưa có pilot thật?**  
Hiện chỉ đo được các chỉ số kỹ thuật như tỷ lệ rule có trace, số issue phát hiện, thời gian tìm nguồn và khả năng ngăn export sai. Tác động doanh nghiệp phải được xác nhận bằng phỏng vấn/pilot, chưa được tuyên bố là đã chứng minh.

**6. Vì sao chọn ống thép RP-ST-001?**  
Đây là phạm vi đủ hẹp để mô hình hóa từ sản phẩm, lô precursor, cơ sở và bằng chứng, đồng thời vẫn đại diện cho bài toán dữ liệu ngành sắt thép.

## Nhóm 2 – Sản phẩm và kỹ thuật

**7. MVP hiện làm được gì?**  
Nhập và tải dữ liệu demo, chạy validation, tạo issue, hiển thị Evidence Graph/trace, chặn release và tạo working export không chứa kết quả số.

**8. MVP chưa làm được gì?**  
Chưa có backend, database, authentication, đa người dùng hoặc tích hợp hệ thống doanh nghiệp; Calculation Engine số đang HOLD.

**9. Dữ liệu lưu ở đâu?**  
Bản hiện tại là SPA chạy cục bộ trong trình duyệt và dùng local storage cho phiên demo. Đây không phải kiến trúc triển khai doanh nghiệp.

**10. Tại sao chạy offline?**  
Để gian trưng bày không phụ thuộc mạng và hạn chế đưa dữ liệu demo ra ngoài. Offline không đồng nghĩa với đã đáp ứng an ninh doanh nghiệp.

**11. Hệ thống xử lý ô trống thế nào?**  
Ô trống giữ là null/MISSING, không tự biến thành 0. Rule liên quan tạo issue và release gate tiếp tục chặn.

**12. Evidence Graph có ý nghĩa gì?**  
Nó biểu diễn quan hệ giữa dữ liệu, nguồn, rule, issue, trace và quyết định gate để người duyệt biết một kết luận dựa vào đâu và đang bị chặn bởi điều gì.

**13. Có bao nhiêu kiểm thử?**  
Bản v0.6.2 có 75 assertion tự động đang PASS. Manual UAT phải chạy lại 10/10 trên đúng bản này và xuất JSON có tên reviewer thật trước khi ký D5.

**14. 75/75 PASS có nghĩa sản phẩm đã chính xác không?**  
Không. Nó chỉ chứng minh hành vi kỹ thuật đã định nghĩa đang chạy đúng; không xác nhận dữ liệu thật, hệ số, kết quả phát thải, tuân thủ hoặc Gate 3.

## Nhóm 3 – Dữ liệu, phương pháp và CBAM

**15. CBAM đang ở giai đoạn nào?**  
Theo Ủy ban châu Âu, chế độ chính thức áp dụng từ 01/01/2026. CarbonGraph vì vậy kiểm soát nguồn phương pháp theo khung definitive-period, không dùng quy định chuyển tiếp làm cơ sở duy nhất cho tính toán 2026.

**16. CarbonGraph có nộp báo cáo CBAM không?**  
Không. Bản MVP chỉ chuẩn bị và truy vết bằng chứng; việc khai báo thuộc chủ thể có nghĩa vụ và hệ thống/quy trình chính thức tương ứng.

**17. CarbonGraph có phải verifier không?**  
Không. Verification là hoạt động độc lập theo quy định và quy trình công nhận; phần mềm không tự nhận vai trò verifier.

**18. Mã CN 7306 30 77 đã là kết luận hải quan chưa?**  
Không. Đây là mã làm việc cho MVP, không phải BTI và không khóa TARIC 10 chữ số.

**19. Dữ liệu hiện tại là dữ liệu gì?**  
Toàn bộ là `SYNTHETIC_DEMO`, dùng để kiểm tra workflow. Không được diễn giải thành dữ liệu nhà máy hoặc kết quả khai báo thật.

**20. Vì sao không hiển thị tCO2e?**  
Vì R-006 về nguồn SEE/precursor còn mở. Hiển thị số lúc này có thể tạo cảm giác chính xác giả, nên numeric bị `BLOCKED/MASKED`.

**21. Điều gì mở được Calculation Engine?**  
Phải khóa nguồn/method/version của factor hoặc default value, hoàn tất provenance và phê duyệt phương pháp, giải quyết R-006, có reference calculation và đạt Gate 2. Không dùng hệ số giả để vượt gate.

**22. Nguồn pháp lý nào đang được kiểm soát?**  
Ít nhất gồm Regulation (EU) 2023/956 đã sửa đổi, Implementing Regulation (EU) 2025/2547 về phương pháp tính, trang legislation/guidance của Ủy ban và hướng dẫn ngành sắt thép definitive-period. Nguồn phải được lưu kèm phiên bản/ngày truy cập.

## Nhóm 4 – Kiểm soát, rủi ro và claims

**23. R-006 là gì?**  
Là rủi ro chưa khóa đủ nguồn SEE/precursor hoặc default value chính thức. Nó không chặn Gate 1 nhưng chặn Calculation Engine và mọi kết quả phát thải số.

**24. R-007 là gì?**  
Là rủi ro truyền thông vượt quá bằng chứng. Nó chỉ được đóng khi app, deck, poster, brochure, video, script, social và booth đều qua Claims Audit.

**25. Tại sao Gate 1 chỉ CONDITIONAL PASS?**  
Nội dung phạm vi đã đủ để phát triển nhưng quyết định cuối còn phụ thuộc việc đóng các hành động hành chính, thống nhất tài liệu và chữ ký Trọng Khang–Minh Thư.

**26. REVIEW_COMPLETE trong UAT có đóng Gate 3 không?**  
Không. Nó chỉ ghi trạng thái bản ghi UAT. Gate 3 cần bằng chứng D1–D6, closure log, RC1 và quyết định của người có thẩm quyền.

**27. Nếu tìm thấy tuyên bố “tuân thủ/chứng nhận CBAM” thì làm gì?**  
Chặn phát hành bề mặt đó, ghi finding với trang/timecode, sửa bằng mô tả phạm vi được phép, quét lại rồi mới xin duyệt.

## Nhóm 5 – Kinh doanh, triển khai và lộ trình

**28. Mô hình kinh doanh dự kiến là gì?**  
Chưa khóa. Giả thuyết cần kiểm chứng là phần mềm B2B theo thuê bao hoặc phí pilot/triển khai; không trình bày doanh thu hay willingness-to-pay như dữ kiện trước phỏng vấn.

**29. Làm sao chuyển từ demo sang pilot?**  
Chọn một doanh nghiệp và một dòng sản phẩm, ký thỏa thuận dữ liệu, lập data mapping, triển khai backend/phân quyền/audit log, xác nhận phương pháp với chuyên gia và chạy song song với quy trình hiện hữu.

**30. Ba ưu tiên sau cuộc thi là gì?**  
Một là phỏng vấn và pilot để xác nhận nhu cầu; hai là giải quyết R-006 và kiểm soát phương pháp; ba là nâng kiến trúc từ SPA demo lên hệ thống có backend, phân quyền và lịch sử kiểm toán.

## Nguồn chính thức dùng cho câu hỏi pháp lý

- European Commission – CBAM: https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en
- European Commission – Legislation and guidance: https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en
- Regulation (EU) 2023/956, consolidated text: https://eur-lex.europa.eu/eli/reg/2023/956/2025-10-20/eng
- Implementing Regulation (EU) 2025/2547: https://eur-lex.europa.eu/eli/reg_impl/2025/2547/oj/eng

Các câu trả lời trên là nội dung thuyết trình dự án, không phải tư vấn pháp lý.
