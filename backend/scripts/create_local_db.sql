-- 설치형 PostgreSQL에 로컬 개발용 계정·DB 만들기 (pgAdmin Query Tool 또는 psql에서 postgres 계정으로 실행)
CREATE ROLE pixelmart LOGIN PASSWORD 'pixelmart';
CREATE DATABASE pixelmart OWNER pixelmart;
CREATE DATABASE pixelmart_test OWNER pixelmart;
