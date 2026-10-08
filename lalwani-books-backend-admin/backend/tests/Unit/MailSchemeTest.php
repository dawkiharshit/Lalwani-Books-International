<?php

namespace Tests\Unit;

use App\Support\MailConfig;
use PHPUnit\Framework\TestCase;

class MailSchemeTest extends TestCase
{
    public function test_standard_ports_decide_the_scheme_whatever_the_dropdown_says(): void
    {
        // "SSL" + 587 used to open TLS on a STARTTLS port: "wrong version number".
        $this->assertSame('smtp', MailConfig::scheme(587, 'ssl'));
        $this->assertSame('smtp', MailConfig::scheme(587, 'tls'));
        $this->assertSame('smtps', MailConfig::scheme(465, 'tls'));
        $this->assertSame('smtps', MailConfig::scheme(465, 'ssl'));
        $this->assertSame('smtp', MailConfig::scheme(2525, 'ssl'));
    }

    public function test_dropdown_decides_on_a_non_standard_port(): void
    {
        $this->assertSame('smtps', MailConfig::scheme(1025, 'ssl'));
        $this->assertSame('smtp', MailConfig::scheme(1025, 'tls'));
    }
}
