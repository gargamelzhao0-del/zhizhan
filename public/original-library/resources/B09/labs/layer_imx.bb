# i.MX6ULL · Yocto 自定义层中的一个应用配方（示例）
SUMMARY = "Edge application"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"
SRC_URI = "file://edge-app.c"

S = "${WORKDIR}"

do_compile() {
    ${CC} ${CFLAGS} ${LDFLAGS} edge-app.c -o edge-app
}

do_install() {
    install -d ${D}${bindir}
    install -m 0755 edge-app ${D}${bindir}
}
