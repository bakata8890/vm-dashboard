CREATE TABLE IF NOT EXISTS vms (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(50)  NOT NULL
                            CHECK (length(name) >= 3)
                            CHECK (name ~ '^[a-zA-Z0-9][a-zA-Z0-9 _-]*$'),
    cores      INT          NOT NULL CHECK (cores      BETWEEN 1 AND 64),
    ram_gb     INT          NOT NULL CHECK (ram_gb     BETWEEN 1 AND 512),
    disk_gb    INT          NOT NULL CHECK (disk_gb    BETWEEN 1 AND 4096),
    os         TEXT         NOT NULL CHECK (os IN (
                                'Ubuntu 22.04',
                                'Windows Server 2022',
                                'CentOS 8',
                                'Debian 12',
                                'Rocky Linux 9'
                            )),
    status     TEXT         NOT NULL DEFAULT 'apagada' CHECK (status IN ('encendida', 'apagada')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
