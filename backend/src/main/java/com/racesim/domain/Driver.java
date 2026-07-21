package com.racesim.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "drivers")
public class Driver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Upstream driverRef / driver_number, used for idempotent ingestion. */
    @Column(name = "external_ref", unique = true)
    private String externalRef;

    @Column(nullable = false)
    private String code; // e.g. VER, HAM

    private String givenName;
    private String familyName;
    private String constructorName;
    private String nationality;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getExternalRef() { return externalRef; }
    public void setExternalRef(String externalRef) { this.externalRef = externalRef; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getGivenName() { return givenName; }
    public void setGivenName(String givenName) { this.givenName = givenName; }
    public String getFamilyName() { return familyName; }
    public void setFamilyName(String familyName) { this.familyName = familyName; }
    public String getConstructorName() { return constructorName; }
    public void setConstructorName(String constructorName) { this.constructorName = constructorName; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }

    public String getFullName() {
        return (givenName == null ? "" : givenName + " ") + (familyName == null ? "" : familyName);
    }
}
