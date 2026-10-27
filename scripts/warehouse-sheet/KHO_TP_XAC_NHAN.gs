/*************************************************
 * KHO_TP_XAC_NHAN.gs
 *
 * Đặt code này trong Apps Script của FILE KHO.
 *************************************************/


/*************************************************
 * 1. CẤU HÌNH SHEET NHẬP
 *************************************************/
const KHO_TP_TARGET_SHEET_NAME =
  "NHAP";


/*************************************************
 * 2. VỊ TRÍ CỘT TẠI SHEET NHAP
 *************************************************/
const KHO_TP_TARGET_COL = {

  RECEIPT_DATE: 1,          // A - Ngày
  RECEIPT_NO: 2,            // B - Phiếu nhập
  SKU: 3,                   // C - Mã hàng
  PRODUCT_NAME: 4,          // D - Tên hàng
  QUANTITY: 5,              // E - Số lượng SX đề nghị
  SPECIFICATION: 6,         // F - Quy cách
  WAREHOUSE_NOTE: 7,        // G - Ghi chú

  SOURCE: 8,                // H - Nguồn dữ liệu
  LSX: 9,                   // I - Mã LSX
  REPORT_ID: 10,            // J - ID báo công
  PLAN_ID: 11,              // K - Plan ID
  LINE: 12,                 // L - Line

  RECEIVE_STATUS: 13,       // M - Trạng thái tiếp nhận
  ACTUAL_QUANTITY: 14,      // N - Số lượng thực nhận
  DIFFERENCE: 15,           // O - Chênh lệch
  DIFFERENCE_REASON: 16,    // P - Lý do chênh lệch

  SENT_TIME: 17,            // Q - Thời gian SX gửi
  CONFIRMED_TIME: 18,       // R - Thời gian Kho xác nhận
  CONFIRMED_BY: 19,         // S - Người Kho xác nhận

  FEEDBACK_STATUS: 20,      // T - Trạng thái phản hồi SX
  FEEDBACK_ERROR: 21,       // U - Chi tiết lỗi phản hồi

  CANCEL_STATUS: 22,        // V - Trạng thái hủy
  CANCEL_REQUEST_ID: 23,    // W - Request ID hủy
  CANCEL_TIME: 24,          // X - Thời gian Kho duyệt hủy
  CANCEL_BY: 25,            // Y - Người Kho duyệt hủy
  CANCEL_NOTE: 26           // Z - Lý do / ý kiến hủy
};


/*************************************************
 * 3. TRẠNG THÁI
 *************************************************/
const KHO_TP_TARGET_STATUS = {

  WAITING:
    "CHỜ KHO XÁC NHẬN",

  CONFIRMED:
    "KHO ĐÃ XÁC NHẬN",

  DIFFERENCE:
    "CÓ CHÊNH LỆCH",

  REJECTED:
    "KHO TỪ CHỐI",

  CANCEL_PENDING:
    "CHỜ XỬ LÝ YÊU CẦU HỦY",

  CANCELLED:
    "ĐÃ HỦY THEO YÊU CẦU SX"
};


const KHO_TP_CANCEL_STATUS = {

  NONE:
    "",

  WAITING:
    "CHỜ KHO XỬ LÝ",

  APPROVED:
    "KHO ĐỒNG Ý HỦY",

  REJECTED:
    "KHO TỪ CHỐI HỦY"
};


const KHO_TP_FEEDBACK_STATUS = {
  NOT_SENT: "CHƯA PHẢN HỒI SX",
  SENT: "ĐÃ PHẢN HỒI SX",
  ERROR: "LỖI PHẢN HỒI SX"
};


/*************************************************
 * 4. TẠO MENU XÁC NHẬN KHO
 *
 * Nếu dự án Kho đã có onOpen thì không tạo thêm
 * onOpen mới. Chỉ gọi:
 *
 * KHO_TP_taoMenuKho_();
 *************************************************/
function KHO_TP_taoMenuKho_() {
  SpreadsheetApp
    .getUi()
    .createMenu(
      "📦 KHO THÀNH PHẨM"
    )
    .addItem(
      "Xác nhận dòng đang chọn",
      "KHO_TP_xacNhanDongDangChon"
    )
    .addToUi();
}


/*************************************************
 * CHỈ GIỮ HÀM NÀY NẾU FILE KHO
 * CHƯA CÓ HÀM onOpen KHÁC
 *************************************************/
function onOpen(e) {
  KHO_TP_taoMenuKho_();
}


/*************************************************
 * 5. KHO XÁC NHẬN DÒNG ĐANG CHỌN
 *
 * Nếu N trống:
 * - Mặc định Kho nhận đủ.
 * - N tự lấy số lượng tại E.
 *
 * Nếu N đã có số:
 * - Giữ số lượng Kho đã nhập.
 *
 * O = N - E.
 *************************************************/
function KHO_TP_xacNhanDongDangChon() {
  const lock =
    LockService.getDocumentLock();

  try {
    lock.waitLock(30000);

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const sh =
      ss.getActiveSheet();

    if (
      sh.getName() !==
      KHO_TP_TARGET_SHEET_NAME
    ) {
      throw new Error(
        'Vui lòng mở sheet "NHAP" rồi chọn dòng cần xác nhận.'
      );
    }

    const selectedRange =
      sh.getActiveRange();

    if (!selectedRange) {
      throw new Error(
        "Vui lòng chọn dòng cần xác nhận."
      );
    }

    const row =
  selectedRange.getRow();

if (row < 2) {
  throw new Error(
    "Không được xác nhận dòng tiêu đề."
  );
}


/*************************************************
 * KIỂM TRA DÒNG ĐÃ ĐƯỢC KHO XÁC NHẬN
 *************************************************/
const currentReceiveStatus =
  String(
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.RECEIVE_STATUS
    ).getDisplayValue() || ""
  )
    .trim()
    .toUpperCase();
    /*************************************************
 * KHÔNG CHO KHO XÁC NHẬN
 * KHI DÒNG ĐANG / ĐÃ ĐƯỢC XỬ LÝ HỦY
 *************************************************/
if (
  currentReceiveStatus ===
    KHO_TP_TARGET_STATUS.CANCEL_PENDING ||

  currentReceiveStatus ===
    KHO_TP_TARGET_STATUS.CANCELLED
) {

  KHO_TP_KHO_hienThongBaoGiua_(
    "error",

    "KHÔNG THỂ XÁC NHẬN",

    currentReceiveStatus ===
      KHO_TP_TARGET_STATUS.CANCELLED

      ? (
          "⛔ Dòng này đã được hủy theo yêu cầu của Sản xuất." +
          "<br><br>" +
          "Dữ liệu cũ chỉ được giữ để truy xuất lịch sử." +
          "<br><br>" +
          "<b>Kho không được xác nhận lại dòng này.</b>"
        )

      : (
          "⏳ Dòng này đang có yêu cầu hủy từ Sản xuất." +
          "<br><br>" +
          "Kho phải xử lý yêu cầu hủy trước khi tiếp tục."
        )
  );

  return;
}

if (
  currentReceiveStatus === "KHO ĐÃ XÁC NHẬN" ||
  currentReceiveStatus === "CÓ CHÊNH LỆCH"
) {
  KHO_TP_KHO_hienThongBaoGiua_(
    "error",
    "DÒNG ĐÃ ĐƯỢC XÁC NHẬN",
    "Dòng " +
      row +
      " đã được Kho xác nhận trước đó.<br><br>" +
      "<b>Trạng thái:</b> " +
      currentReceiveStatus +
      "<br><br>" +
      "Không thể xác nhận lại để tránh thay đổi thời gian và người xác nhận."
  );

  return;
}


/*************************************************
 * TIẾP TỤC KIỂM TRA DỮ LIỆU SX_LOG
 *************************************************/
const source =
  String(
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.SOURCE
    ).getDisplayValue() || ""
  ).trim();

const reportId =
  String(
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.REPORT_ID
    ).getDisplayValue() || ""
  ).trim();

    /*
     * Chỉ xác nhận dòng được chuyển từ SX_LOG.
     * Dòng Kho nhập thủ công không chạy hàm này.
     */
    if (
      !["SX_LOG", "ONSPA_WEB"].includes(source) ||
      !reportId
    ) {
      throw new Error(
        "Dòng đang chọn không phải phiếu SX_LOG hoặc ONSPA_WEB hợp lệ."
      );
    }

    if (source === "ONSPA_WEB" && !Session.getActiveUser().getEmail()) {
      throw new Error("Không xác định được email người xác nhận. Đăng nhập tài khoản Google của kho trước khi xác nhận.");
    }
    const proposedQuantity =
      KHO_TP_chuanHoaSoLuongKho_(
        sh.getRange(
          row,
          KHO_TP_TARGET_COL.QUANTITY
        ).getValue()
      );

    if (
      !Number.isFinite(
        proposedQuantity
      ) ||
      proposedQuantity <= 0
    ) {
      throw new Error(
        "Số lượng SX đề nghị tại cột E không hợp lệ."
      );
    }

    const actualQuantityCell =
      sh.getRange(
        row,
        KHO_TP_TARGET_COL.ACTUAL_QUANTITY
      );

    let actualQuantity;

    /*
     * Nếu N đang trống:
     * mặc định nhận đủ theo cột E.
     */
    if (
      actualQuantityCell.isBlank()
    ) {
      actualQuantity =
        proposedQuantity;

      actualQuantityCell
        .setValue(
          actualQuantity
        )
        .setNumberFormat(
          "#,##0.00"
        );

    } else {
      actualQuantity =
        KHO_TP_chuanHoaSoLuongKho_(
          actualQuantityCell.getValue()
        );
    }

    if (
      !Number.isFinite(
        actualQuantity
      ) ||
      actualQuantity < 0
    ) {
      throw new Error(
        "Số lượng Kho thực nhận tại cột N không hợp lệ."
      );
    }

    const difference =
      actualQuantity -
      proposedQuantity;

    const differenceCell =
      sh.getRange(
        row,
        KHO_TP_TARGET_COL.DIFFERENCE
      );

    differenceCell
      .setValue(
        difference
      )
      .setNumberFormat(
        "#,##0.00"
      );

    const differenceReason =
      String(
        sh.getRange(
          row,
          KHO_TP_TARGET_COL.DIFFERENCE_REASON
        ).getDisplayValue() || ""
      ).trim();

    /*
     * Có chênh lệch thì bắt buộc nhập lý do.
     */
    if (
      Math.abs(difference) >
        0.000001 &&
      !differenceReason
    ) {
      throw new Error(
        "Số lượng có chênh lệch " +
        difference +
        ". Vui lòng nhập lý do tại cột P rồi xác nhận lại."
      );
    }

    const status =
      Math.abs(difference) <=
        0.000001
        ? KHO_TP_TARGET_STATUS.CONFIRMED
        : KHO_TP_TARGET_STATUS.DIFFERENCE;

    const statusCell =
      sh.getRange(
        row,
        KHO_TP_TARGET_COL.RECEIVE_STATUS
      );

    statusCell.setValue(
      status
    );

    /*
     * Thời gian Kho xác nhận.
     */
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.CONFIRMED_TIME
    )
      .setValue(
        new Date()
      )
      .setNumberFormat(
        "dd/MM/yyyy HH:mm:ss"
      );

    /*
     * Chỉ lấy email người đang thao tác.
     *
     * Không dùng getEffectiveUser()
     * để tránh tự ghi email chủ file.
     */
    const confirmer =
      String(
        Session
          .getActiveUser()
          .getEmail() || ""
      ).trim();

    sh.getRange(
      row,
      KHO_TP_TARGET_COL.CONFIRMED_BY
    ).setValue(
      confirmer ||
      "KHÔNG XÁC ĐỊNH"
    );

    /*
     * Sau khi Kho xác nhận,
     * trạng thái chờ phản hồi về SX.
     */
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.FEEDBACK_STATUS
    ).setValue(
      KHO_TP_FEEDBACK_STATUS.NOT_SENT
    );

    sh.getRange(
      row,
      KHO_TP_TARGET_COL.FEEDBACK_ERROR
    ).clearContent();


    /*********************************************
     * MÀU TRẠNG THÁI
     *********************************************/
    if (
      status ===
      KHO_TP_TARGET_STATUS.CONFIRMED
    ) {
      /*
       * Nhận đủ: màu xanh lá.
       */
      statusCell
        .setBackground(
          "#B7E1CD"
        )
        .setFontColor(
          "#0B5720"
        )
        .setFontWeight(
          "bold"
        )
        .setHorizontalAlignment(
          "center"
        );

      actualQuantityCell
        .setBackground(
          "#D9EAD3"
        )
        .setFontColor(
          "#274E13"
        );

      differenceCell
        .setBackground(
          "#D9EAD3"
        )
        .setFontColor(
          "#274E13"
        );

    } else {
      /*
       * Có chênh lệch: màu cam.
       */
      statusCell
        .setBackground(
          "#F9CB9C"
        )
        .setFontColor(
          "#783F04"
        )
        .setFontWeight(
          "bold"
        )
        .setHorizontalAlignment(
          "center"
        );

      actualQuantityCell
        .setBackground(
          "#FCE5CD"
        )
        .setFontColor(
          "#A61C00"
        );

      differenceCell
        .setBackground(
          "#FCE5CD"
        )
        .setFontColor(
          "#A61C00"
        );
    }

    SpreadsheetApp.flush();

    KHO_TP_dinhDangTrangThaiDongKho_(
  sh,
  row
);

if (source === "ONSPA_WEB" && !ONSPA_guiXacNhan_(sh,row)) {
  KHO_TP_KHO_hienThongBaoGiua_("error","ĐÃ XÁC NHẬN TẠI SHEET — CHƯA ĐỒNG BỘ WEB","Kết quả kho đã được lưu. Xem lỗi tại cột U. Hệ thống tự gửi lại mỗi phút; không cần xác nhận lần nữa.");
  return;
}
KHO_TP_KHO_hienThongBaoGiua_(
  "success",
  "XÁC NHẬN NHẬP KHO THÀNH CÔNG",
  "Kho đã xác nhận dữ liệu thành công.<br><br>" +
  "<b>ID báo công:</b> " + reportId + "<br>" +
  "<b>Dòng:</b> " + row + "<br>" +
  "<b>Số lượng SX đề nghị:</b> " + proposedQuantity + "<br>" +
  "<b>Số lượng Kho thực nhận:</b> " + actualQuantity + "<br>" +
  "<b>Chênh lệch:</b> " + difference + "<br><br>" +
  "<b>Trạng thái:</b> " + status
);

  } catch (error) {
  const errorMessage =
    error && error.message
      ? error.message
      : String(error);

  KHO_TP_KHO_hienThongBaoGiua_(
    "error",
    "KHÔNG THỂ XÁC NHẬN",
    errorMessage
  );

  console.error(
    error && error.stack
      ? error.stack
      : String(error)
  );

  } finally {
    try {
      lock.releaseLock();
    } catch (ignoreError) {
      // Không cần xử lý.
    }
  }
}


/*************************************************
 * 6. CHUẨN HÓA SỐ LƯỢNG
 *************************************************/
function KHO_TP_chuanHoaSoLuongKho_(
  value
) {
  if (
    typeof value === "number"
  ) {
    return value;
  }

  let text =
    String(
      value || ""
    )
      .trim()
      .replace(/\s/g, "");

  if (!text) {
    return 0;
  }

  if (
    text.indexOf(".") !== -1 &&
    text.indexOf(",") !== -1
  ) {
    if (
      text.lastIndexOf(",") >
      text.lastIndexOf(".")
    ) {
      text =
        text
          .replace(/\./g, "")
          .replace(",", ".");
    } else {
      text =
        text.replace(/,/g, "");
    }

  } else if (
    text.indexOf(",") !== -1
  ) {
    const parts =
      text.split(",");

    if (
      parts.length === 2 &&
      parts[1].length <= 2
    ) {
      text =
        parts[0] +
        "." +
        parts[1];
    } else {
      text =
        text.replace(/,/g, "");
    }
  }

  const result =
    Number(text);

  return Number.isFinite(result)
    ? result
    : NaN;
}
/*************************************************
 * KHO_TP_DINH_DANG.gs
 *
 * ĐỊNH DẠNG SHEET NHAP CỦA KHO THÀNH PHẨM
 *
 * Không xóa hoặc thay đổi dữ liệu.
 *************************************************/
function KHO_TP_thietLapSheetNhap() {
  try {
    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const sh =
      ss.getSheetByName(
        KHO_TP_TARGET_SHEET_NAME
      );

    if (!sh) {
      throw new Error(
        'Không tìm thấy sheet "' +
        KHO_TP_TARGET_SHEET_NAME +
        '".'
      );
    }

    if (
  sh.getMaxColumns() < 26
) {

  sh.insertColumnsAfter(
    sh.getMaxColumns(),
    26 - sh.getMaxColumns()
  );
}

    const headers = [[

  "NGÀY",                         // A
  "PHIẾU NHẬP",                  // B
  "MÃ HÀNG",                     // C
  "TÊN HÀNG",                    // D
  "SỐ LƯỢNG",                    // E
  "QUY CÁCH",                    // F
  "GHI CHÚ",                     // G

  "NGUỒN DỮ LIỆU",               // H
  "MÃ LSX",                      // I
  "ID BÁO CÔNG",                 // J
  "PLAN ID",                     // K
  "LINE",                        // L
  "TRẠNG THÁI TIẾP NHẬN",        // M
  "SỐ LƯỢNG KHO THỰC NHẬN",      // N
  "CHÊNH LỆCH",                  // O
  "LÝ DO CHÊNH LỆCH",            // P
  "THỜI GIAN SX GỬI",            // Q
  "THỜI GIAN KHO XÁC NHẬN",      // R
  "NGƯỜI KHO XÁC NHẬN",          // S
  "TRẠNG THÁI PHẢN HỒI SX",      // T
  "CHI TIẾT LỖI PHẢN HỒI SX",    // U

  "TRẠNG THÁI HỦY",              // V
  "REQUEST ID HỦY",              // W
  "THỜI GIAN DUYỆT HỦY",         // X
  "NGƯỜI DUYỆT HỦY",             // Y
  "LÝ DO / Ý KIẾN HỦY"           // Z
]];

    sh.getRange(
      1,
      1,
      1,
      26
    ).setValues(
      headers
    );


    /*********************************************
     * TIÊU ĐỀ A:G — DỮ LIỆU KHO
     *********************************************/
    sh.getRange(
      1,
      1,
      1,
      7
    )
      .setBackground("#38761D")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setWrap(true);


    /*********************************************
     * TIÊU ĐỀ H:U — ĐỒNG BỘ SX
     *********************************************/
    sh.getRange(
      1,
      8,
      1,
      14
    )
      .setBackground("#1F4E78")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setWrap(true);

    sh.getRange(
      1,
      1,
      1,
      21
    ).setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      "#FFFFFF",
      SpreadsheetApp.BorderStyle.SOLID
    );

    sh.setRowHeight(1, 45);
    sh.setFrozenRows(1);
    /*********************************************
 * V:Z — NGHIỆP VỤ HỦY
 *********************************************/
sh.getRange(
  1,
  22,
  1,
  5
)
  .setBackground(
    "#674EA7"
  )
  .setFontColor(
    "#FFFFFF"
  )
  .setFontWeight(
    "bold"
  )
  .setHorizontalAlignment(
    "center"
  )
  .setVerticalAlignment(
    "middle"
  )
  .setWrap(
    true
  );


    /*********************************************
     * ĐỘ RỘNG CỘT
     *********************************************/
    const widths = [
      95,  // A
      155, // B
      115, // C
      260, // D
      110, // E
      130, // F
      220, // G
      120, // H
      135, // I
      190, // J
      190, // K
      90,  // L
      180, // M
      160, // N
      110, // O
      220, // P
      155, // Q
      155, // R
      190, // S
      180, // T
      260,  // U
      190, // V
180, // W
165,// X
210, // Y
280, // Z
    ];

    widths.forEach(function(width, index) {
      sh.setColumnWidth(
        index + 1,
        width
      );
    });


    /*********************************************
     * ĐỊNH DẠNG VÙNG DỮ LIỆU ĐANG SỬ DỤNG
     *********************************************/
    const lastRow =
      Math.max(
        sh.getLastRow(),
        2
      );

    const rowCount =
      lastRow - 1;

    /*
     * Khung A:U.
     */
    sh.getRange(
      2,
      1,
      rowCount,
      21
    )
      .setVerticalAlignment("middle")
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        "#B7C3CE",
        SpreadsheetApp.BorderStyle.SOLID
      );

    /*
     * Không tô lại toàn bộ A:G để tránh thay đổi
     * màu dữ liệu Kho cũ.
     *
     * Chỉ tô H:U cho dòng từ SX_LOG.
     */
    const sources =
      sh.getRange(
        2,
        KHO_TP_TARGET_COL.SOURCE,
        rowCount,
        1
      ).getDisplayValues();

    for (
      let index = 0;
      index < sources.length;
      index++
    ) {
      const row =
        index + 2;

      const source =
        String(
          sources[index][0] || ""
        ).trim();

      if (source === "SX_LOG") {
        /*
         * A:G - xanh lá rất nhạt.
         */
        sh.getRange(
          row,
          1,
          1,
          7
        ).setBackground(
          "#EAF4E2"
        );

        /*
         * H:U - xanh dương rất nhạt.
         */
        sh.getRange(
          row,
          8,
          1,
          14
        ).setBackground(
          "#EAF3F8"
        );

        KHO_TP_dinhDangTrangThaiDongKho_(
          sh,
          row
        );
      }
    }

    sh.getRange(
      2,
      KHO_TP_TARGET_COL.RECEIPT_DATE,
      rowCount,
      1
    ).setNumberFormat(
      "dd/MM/yyyy"
    );

    sh.getRange(
      2,
      KHO_TP_TARGET_COL.QUANTITY,
      rowCount,
      1
    ).setNumberFormat(
      "#,##0.00"
    );

    sh.getRange(
      2,
      KHO_TP_TARGET_COL.ACTUAL_QUANTITY,
      rowCount,
      2
    ).setNumberFormat(
      "#,##0.00"
    );

    sh.getRange(
      2,
      KHO_TP_TARGET_COL.SENT_TIME,
      rowCount,
      2
    ).setNumberFormat(
      "dd/MM/yyyy HH:mm:ss"
    );

    SpreadsheetApp.flush();

    KHO_TP_KHO_hienThongBaoGiua_(
      "THIẾT LẬP ĐỊNH DẠNG THÀNH CÔNG",
      "Đã thiết lập tiêu đề, màu và khung cho sheet NHAP.\n\n" +
      "Dữ liệu cũ của Kho không bị xóa hoặc thay đổi."
    );

  } catch (error) {
    KHO_TP_KHO_hienThongBaoGiua_(
      "KHÔNG THỂ ĐỊNH DẠNG",
      error && error.message
        ? error.message
        : String(error)
    );
  }
}


/*************************************************
 * ĐỊNH DẠNG TRẠNG THÁI CỦA MỘT DÒNG KHO
 *************************************************/
function KHO_TP_dinhDangTrangThaiDongKho_(
  sh,
  row
) {
  const receiveStatusCell =
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.RECEIVE_STATUS
    );

  const feedbackStatusCell =
    sh.getRange(
      row,
      KHO_TP_TARGET_COL.FEEDBACK_STATUS
    );

  const receiveStatus =
    String(
      receiveStatusCell
        .getDisplayValue() || ""
    )
      .trim()
      .toUpperCase();

  const feedbackStatus =
    String(
      feedbackStatusCell
        .getDisplayValue() || ""
    )
      .trim()
      .toUpperCase();

  /*
   * Trạng thái tiếp nhận tại cột M.
   */
  if (
    receiveStatus ===
    "CHỜ KHO XÁC NHẬN"
  ) {
    receiveStatusCell
      .setBackground("#FFF2CC")
      .setFontColor("#7F6000")
      .setFontWeight("bold");

  } else if (
    receiveStatus ===
    "KHO ĐÃ XÁC NHẬN"
  ) {
    receiveStatusCell
      .setBackground("#B7E1CD")
      .setFontColor("#0B5720")
      .setFontWeight("bold");

  } else if (
    receiveStatus ===
    "CÓ CHÊNH LỆCH"
  ) {
    receiveStatusCell
      .setBackground("#F9CB9C")
      .setFontColor("#783F04")
      .setFontWeight("bold");

  } else if (
    receiveStatus ===
    "KHO TỪ CHỐI"
  ) {
    receiveStatusCell
      .setBackground("#F4CCCC")
      .setFontColor("#990000")
      .setFontWeight("bold");
  }

  /*
   * Trạng thái phản hồi tại cột T.
   */
  if (
    feedbackStatus ===
    "ĐÃ PHẢN HỒI SX"
  ) {
    feedbackStatusCell
      .setBackground("#B7E1CD")
      .setFontColor("#0B5720")
      .setFontWeight("bold");

  } else if (
    feedbackStatus ===
    "CHƯA PHẢN HỒI SX"
  ) {
    feedbackStatusCell
      .setBackground("#FFF2CC")
      .setFontColor("#7F6000")
      .setFontWeight("bold");

  } else if (
    feedbackStatus ===
    "LỖI PHẢN HỒI SX"
  ) {
    feedbackStatusCell
      .setBackground("#F4CCCC")
      .setFontColor("#990000")
      .setFontWeight("bold");
  }

  receiveStatusCell
    .setHorizontalAlignment("center");

  feedbackStatusCell
    .setHorizontalAlignment("center");
}


/*************************************************
 * THÔNG BÁO GIỮA MÀN HÌNH FILE KHO
 *************************************************/
function KHO_TP_KHO_hienThongBaoGiua_(
  type,
  title,
  message
) {
  const isSuccess =
    type === "success";

  const mainColor =
    isSuccess
      ? "#2E7D32"
      : "#C62828";

  const lightColor =
    isSuccess
      ? "#E8F5E9"
      : "#FFEBEE";

  const icon =
    isSuccess
      ? "✓"
      : "✕";

  const safeTitle =
    String(title || "THÔNG BÁO");

  const safeMessage =
    String(message || "")
      .replace(/\n/g, "<br>");

  const html =
    HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">

          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              background: #ffffff;
            }

            .box {
              background: ${lightColor};
              border: 3px solid ${mainColor};
              border-radius: 16px;
              padding: 25px 30px;
              text-align: center;
              box-sizing: border-box;
            }

            .icon {
              width: 65px;
              height: 65px;
              margin: 0 auto 15px;
              border-radius: 50%;
              background: ${mainColor};
              color: white;
              font-size: 40px;
              font-weight: bold;
              line-height: 65px;
            }

            .title {
              color: ${mainColor};
              font-size: 22px;
              font-weight: bold;
              margin-bottom: 18px;
            }

            .message {
              background: #ffffff;
              border-radius: 10px;
              padding: 16px 20px;
              color: #333333;
              font-size: 15px;
              line-height: 1.7;
              text-align: left;
            }

            button {
              margin-top: 20px;
              min-width: 120px;
              background: ${mainColor};
              color: white;
              border: none;
              border-radius: 8px;
              padding: 11px 25px;
              font-size: 15px;
              font-weight: bold;
              cursor: pointer;
            }
          </style>
        </head>

        <body>

          <div class="box">

            <div class="icon">
              ${icon}
            </div>

            <div class="title">
              ${safeTitle}
            </div>

            <div class="message">
              ${safeMessage}
            </div>

            <button onclick="google.script.host.close()">
              ĐÓNG
            </button>

          </div>

        </body>
      </html>
    `)
    .setWidth(500)
    .setHeight(450);

  SpreadsheetApp
    .getUi()
    .showModalDialog(
      html,
      safeTitle
    );
}